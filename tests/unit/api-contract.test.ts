import { describe, expect, it } from "vitest";
import { API_ROUTES, buildPath, compareVersions, pathParams, type RouteName } from "@/lib/api/routes";
import { applyOfflineSale, buildOfflineBill, lookupInSnapshot, offlineSeries, type OfflineBillSettings } from "@/lib/offline-bill";
import { parseOfflineNumber } from "@/lib/numbering";

// The shared route list is the contract between the server and the apps. These tests keep it sound.

const names = Object.keys(API_ROUTES) as RouteName[];

describe("API route list", () => {
  it("has one route per method + path", () => {
    const seen = new Set<string>();
    for (const n of names) {
      const key = `${API_ROUTES[n].method} ${API_ROUTES[n].path}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("dispatches every concrete URL to its own route (no route shadows another)", async () => {
    // Loading the handlers needs a config; nothing connects to a database here.
    process.env.MONGODB_URI ??= "mongodb://127.0.0.1:1/contract-test";
    process.env.BETTER_AUTH_SECRET ??= "contract-test-secret-".padEnd(40, "x");
    process.env.APP_URL ??= "http://localhost:3000";
    const { match, ROUTES } = await import("@/server/api/routes");
    expect(ROUTES.map((r) => r.name).sort()).toEqual([...names].sort());
    for (const n of names) {
      const spec = API_ROUTES[n];
      const url = buildPath(spec.path, Object.fromEntries(pathParams(spec.path).map((p) => [p, "0123456789abcdef01234567"])));
      expect(match(spec.method, url)?.route.name, `${spec.method} ${url}`).toBe(n);
    }
  });

  it("only declares query keys on GET routes and only path names made of letters", () => {
    for (const n of names) {
      const spec = API_ROUTES[n] as { method: string; path: string; query?: readonly string[] };
      if (spec.query) expect(spec.method, n).toBe("GET");
      for (const p of pathParams(spec.path)) expect(p).toMatch(/^[A-Za-z]+$/);
    }
  });

  it("builds paths and refuses missing parameters", () => {
    expect(buildPath("/sales/:saleId/refund", { saleId: "abc" })).toBe("/sales/abc/refund");
    expect(buildPath("/members/invitations/:invitationId", { invitationId: "a/b" })).toBe("/members/invitations/a%2Fb");
    expect(() => buildPath("/sales/:saleId", {})).toThrow(/saleId/);
  });

  it("compares app versions numerically", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.9.12", "1.0.0")).toBe(-1);
    expect(compareVersions("2.0.0+45", "2.0.0")).toBe(0);
  });
});

describe("shared offline bill", () => {
  const settings: OfflineBillSettings = {
    orgName: "Shop", legalName: "", address: "", phone: "", email: "", taxId: "27AAAAA0000A1Z5", taxMode: "GST", stateCode: "27", roundOff: true,
    currency: "INR", locale: "en-IN", timezone: "Asia/Kolkata", fiscalYearStartMonth: 4, prefixes: { sale: "S", invoice: "INV" },
    receipt: { paperWidth: 58, header: "", footer: "", showHsn: false, upiId: "", showUpiQr: false }, logoUrl: null,
  };
  const hit = { variantId: "v1", name: "Rice", variantName: "5kg", sku: "R5", hsn: "1006", unit: "pcs", scale: 1, mrp: 0, rateBp: 500, cessBp: 0, inclusive: true };
  const now = new Date("2026-11-06T06:00:00Z");

  it("numbers, taxes and builds the sync payload like the server expects", () => {
    const series = offlineSeries(settings, "receipt", now);
    expect(series.key).toBe("S:26-27");
    const r = buildOfflineBill({
      settings, tillCode: "T3", seq: 7, now, clientId: "c1", locationId: "loc", cashierName: "Asha", kind: "receipt",
      customer: { id: "p1", name: "Ravi", phone: "9", stateCode: "29", taxId: "" }, billDiscount: 0,
      lines: [{ hit, qty: 2, unitPrice: 10500, discount: 0, serials: [] }],
      payments: [{ method: "cash", amount: 25000, reference: "" }],
    });
    expect(r.number).toBe("ST3/2627/00007");
    expect(parseOfflineNumber(r.number)).toMatchObject({ deviceCode: "T3", seq: 7 });
    expect(r.total).toBe(21000);
    expect(r.receipt.sale.interState).toBe(true); // customer in another state → IGST
    expect(r.receipt.sale.igst).toBeGreaterThan(0);
    expect(r.receipt.sale.change).toBe(4000);
    expect(r.payload).toMatchObject({ clientId: "c1", customerId: "p1", grandTotal: 21000, lines: [{ variantId: "v1", qty: 2, unitPrice: 10500 }] });
  });

  it("updates the till snapshot after a sale and finds serials", () => {
    const snap = { variants: [{ ...hit, barcode: "890", stock: 5 }], serials: [{ serial: "IMEI1", variantId: "v1" }] };
    expect(lookupInSnapshot(snap, "IMEI1")?.serial).toBe("IMEI1");
    const next = applyOfflineSale(snap, [{ hit, qty: 2, serials: ["IMEI1"] }]);
    expect(next.variants[0].stock).toBe(3);
    expect(next.serials).toHaveLength(0);
  });
});

describe("product image URLs", () => {
  it("accepts uploads in the current per-business format and old flat files", async () => {
    const { productInput } = await import("@/lib/schemas");
    const base = { name: "X", variants: [{ salePrice: 100 }] };
    const ok = (images: string[]) => productInput.safeParse({ ...base, images }).success;
    expect(ok([`/api/org-files/${"a".repeat(24)}/${"b".repeat(32)}.webp`])).toBe(true);
    expect(ok([`/api/files/${"b".repeat(32)}.png`])).toBe(true);
    expect(ok([`/api/org-files/../${"b".repeat(32)}.png`])).toBe(false);
    expect(ok(["https://evil.example/x.png"])).toBe(false);
  });
});
