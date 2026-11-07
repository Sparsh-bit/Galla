import { describe, expect, it } from "vitest";
import { addToCart, cartBill, checkTenders, quickCash, saleLines, setSerials, type CartHit } from "@/lib/pos-cart";

// Cart and payment rules shared by the web POS and the Android app.

let n = 0;
const key = () => `k${++n}`;
const rice: CartHit = { variantId: "rice", name: "Rice", variantName: "", salePrice: 5000, scale: 1, rateBp: 500, cessBp: 0, inclusive: true, trackSerial: false };
const phone: CartHit = { ...rice, variantId: "phone", name: "Phone", salePrice: 1_000_000, trackSerial: true };

describe("cart", () => {
  it("merges repeat scans and keeps the newest line first", () => {
    let r = addToCart([], rice, key);
    if (r.kind !== "added") throw new Error();
    r = addToCart(r.lines, rice, key);
    if (r.kind !== "added") throw new Error();
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(2);
  });

  it("asks for serials, rejects duplicates and counts units by serial", () => {
    expect(addToCart([], phone, key).kind).toBe("needSerial");
    let r = addToCart([], { ...phone, serial: "IMEI1" }, key);
    if (r.kind !== "added") throw new Error();
    expect(addToCart(r.lines, { ...phone, serial: "IMEI1" }, key)).toEqual({ kind: "duplicateSerial", serial: "IMEI1" });
    r = addToCart(r.lines, { ...phone, serial: "IMEI2" }, key);
    if (r.kind !== "added") throw new Error();
    expect(r.lines[0]).toMatchObject({ qty: 2, serials: ["IMEI1", "IMEI2"] });
    expect(setSerials(r.lines, phone, [], key)).toHaveLength(0);
  });

  it("previews the bill with the server's tax engine and sends overrides only", () => {
    const r = addToCart([], rice, key);
    if (r.kind !== "added") throw new Error();
    const lines = [{ ...r.lines[0], qty: 2, unitPrice: 4500 }];
    const bill = cartBill(lines, { billDiscount: 0, taxMode: "GST", orgStateCode: "27", customerStateCode: "29", roundOff: false });
    expect(bill.grandTotal).toBe(9000);
    expect(bill.interState).toBe(true);
    expect(bill.igst).toBeGreaterThan(0);
    expect(saleLines(lines)[0]).toMatchObject({ variantId: "rice", qty: 2, unitPrice: 4500 });
    expect(saleLines(r.lines)[0]).not.toHaveProperty("unitPrice");
  });
});

describe("payment rules", () => {
  it("accepts exact and cash-over payments with change", () => {
    expect(checkTenders(1000, [{ method: "cash", amount: 2000 }], false)).toMatchObject({ change: 1000, problem: null });
    expect(checkTenders(1000, [{ method: "upi", amount: 400 }, { method: "cash", amount: 600 }], false).problem).toBeNull();
  });
  it("rejects short payment, non-cash change and credit without a customer", () => {
    expect(checkTenders(1000, [{ method: "cash", amount: 500 }], false).problem).toMatch(/cover/);
    expect(checkTenders(1000, [{ method: "card", amount: 1500 }], false).problem).toMatch(/cash/);
    expect(checkTenders(1000, [{ method: "credit", amount: 1000 }], false).problem).toMatch(/customer/);
    expect(checkTenders(1000, [{ method: "credit", amount: 1000 }], true).problem).toBeNull();
  });
  it("suggests round cash amounts", () => {
    expect(quickCash(23450)).toEqual([23450, 24000, 25000, 30000, 40000]);
  });
});
