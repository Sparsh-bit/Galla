import { describe, expect, it } from "vitest";
import { hasRealBarcode, isRealBarcode } from "@/lib/barcodes";
import { productInput } from "@/lib/schemas";

const variant = (barcodes: string[]) => ({ name: "", sku: "", barcodes, attributes: [], costPrice: 0, salePrice: 100, mrp: 0, active: true, openingQty: 5 });
const parse = (extra: Record<string, unknown>, barcodes: string[]) => productInput.parse({ name: "Item", variants: [variant(barcodes)], ...extra });

describe("stock is kept only for items with a real barcode", () => {
  it("knows what a real barcode is", () => {
    expect(isRealBarcode("8901234567890")).toBe(true);
    expect(isRealBarcode("ABC-1234")).toBe(true);
    expect(isRealBarcode("")).toBe(false);
    expect(isRealBarcode("12")).toBe(false); // a short product number for the number pad
    expect(isRealBarcode("999")).toBe(false);
    expect(isRealBarcode("2000000000015")).toBe(false); // Galla's own automatic code
    expect(hasRealBarcode([{ barcodes: ["5"] }, { barcodes: ["2000000000015"] }])).toBe(false);
    expect(hasRealBarcode([{ barcodes: ["5"] }, { barcodes: ["8901234567890"] }])).toBe(true);
  });

  it("no barcode: not tracked, whatever the client sends", () => {
    expect(parse({}, []).trackStock).toBe(false);
    expect(parse({ trackStock: true }, []).trackStock).toBe(false);
    expect(parse({ trackStock: true }, ["7"]).trackStock).toBe(false); // a short number is not a barcode
  });

  it("real barcode: tracked, unless deliberately switched off", () => {
    expect(parse({}, ["8901234567890"]).trackStock).toBe(true);
    expect(parse({ trackStock: false }, ["8901234567890"]).trackStock).toBe(false);
  });

  it("batch and serial items always keep stock", () => {
    expect(parse({ trackBatch: true }, []).trackStock).toBe(true);
    expect(parse({ trackSerial: true }, []).trackStock).toBe(true);
  });
});
