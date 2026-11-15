/** Lowercase words a product can be found by: its name, brand, variant names, SKUs and barcodes. */
export function searchTokens(p: { name: string; brand?: string; variants: { name?: string; sku?: string; barcodes?: string[] }[] }): string[] {
  const out = new Set<string>();
  const add = (s: string | undefined) => {
    for (const w of (s ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (w) out.add(w.slice(0, 40));
  };
  add(p.name);
  add(p.brand);
  for (const v of p.variants) {
    add(v.name);
    add(v.sku);
    for (const b of v.barcodes ?? []) add(b);
  }
  return [...out].slice(0, 80);
}
