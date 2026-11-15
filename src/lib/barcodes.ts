/**
 * Stock is kept only for items that have a real barcode. Not real: Galla's own automatic in-store codes (13 digits
 * starting with 2) and short product numbers (1 to 3 digits) that are only for the number pad at the counter.
 */
export const isRealBarcode = (b: string | undefined | null): boolean => {
  const c = (b ?? "").trim();
  return c.length >= 4 && !/^2\d{12}$/.test(c);
};

export const hasRealBarcode = (variants: { barcodes?: readonly string[] }[]): boolean => variants.some((v) => (v.barcodes ?? []).some(isRealBarcode));
