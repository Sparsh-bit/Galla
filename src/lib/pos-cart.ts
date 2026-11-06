// Point-of-sale cart rules shared by the web POS and the Android app: what a scan does to the cart,
// the bill preview (same tax engine as the server) and when a payment is acceptable.
import { computeBill, type TaxMode } from "./tax";

export interface CartHit {
  variantId: string; name: string; variantName: string; salePrice: number; scale: number;
  rateBp: number; cessBp: number; inclusive: boolean; trackSerial: boolean; serial?: string;
}

export interface CartLine<H extends CartHit = CartHit> {
  key: string;
  hit: H;
  qty: number; // scaled integer
  discount: number; // minor units
  unitPrice: number; // minor units (override or hit.salePrice)
  batchId: string | null;
  serials: string[];
}

export type AddResult<H extends CartHit> =
  | { kind: "added"; lines: CartLine<H>[] }
  /** Serial-numbered item scanned without a specific unit: ask which serials are sold. */
  | { kind: "needSerial"; existing: CartLine<H> | null }
  | { kind: "duplicateSerial"; serial: string };

/** Adds a scanned/tapped item. Newest line first; repeat scans add quantity. */
export function addToCart<H extends CartHit>(lines: CartLine<H>[], hit: H, newKey: () => string, qty?: number): AddResult<H> {
  if (hit.trackSerial) {
    const existing = lines.find((l) => l.hit.variantId === hit.variantId) ?? null;
    if (!hit.serial) return { kind: "needSerial", existing };
    if (existing?.serials.includes(hit.serial)) return { kind: "duplicateSerial", serial: hit.serial };
    if (existing) {
      const serials = [...existing.serials, hit.serial];
      return { kind: "added", lines: [{ ...existing, serials, qty: serials.length }, ...lines.filter((l) => l.key !== existing.key)] };
    }
    return { kind: "added", lines: [{ key: newKey(), hit, qty: 1, discount: 0, unitPrice: hit.salePrice, batchId: null, serials: [hit.serial] }, ...lines] };
  }
  const i = lines.findIndex((l) => l.hit.variantId === hit.variantId && !l.batchId);
  if (i >= 0) {
    const updated = { ...lines[i], qty: lines[i].qty + (qty ?? hit.scale) };
    return { kind: "added", lines: [updated, ...lines.filter((_, j) => j !== i)] };
  }
  return { kind: "added", lines: [{ key: newKey(), hit, qty: qty ?? hit.scale, discount: 0, unitPrice: hit.salePrice, batchId: null, serials: [] }, ...lines] };
}

/** Sets the serials sold for a serial-numbered item (qty follows the count). */
export function setSerials<H extends CartHit>(lines: CartLine<H>[], hit: H, serials: string[], newKey: () => string): CartLine<H>[] {
  const existing = lines.find((l) => l.hit.variantId === hit.variantId);
  if (!serials.length) return lines.filter((l) => l.hit.variantId !== hit.variantId);
  if (existing) return lines.map((l) => (l.key === existing.key ? { ...l, serials, qty: serials.length } : l));
  return [{ key: newKey(), hit, qty: serials.length, discount: 0, unitPrice: hit.salePrice, batchId: null, serials }, ...lines];
}

export function cartBill(lines: CartLine[], o: { billDiscount: number; taxMode: TaxMode; orgStateCode: string; customerStateCode?: string | null; roundOff: boolean }) {
  const interState = o.taxMode === "GST" && !!o.customerStateCode && !!o.orgStateCode && o.customerStateCode !== o.orgStateCode;
  const bill = computeBill({
    lines: lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty, scale: l.hit.scale, discount: l.discount, rateBp: l.hit.rateBp, cessBp: l.hit.cessBp, inclusive: l.hit.inclusive })),
    billDiscount: o.billDiscount, mode: o.taxMode, interState, roundOff: o.roundOff,
  });
  const itemCount = lines.reduce((a, l) => a + (l.hit.scale === 1 ? l.qty : 1), 0);
  return { ...bill, interState, itemCount };
}

/** Sale lines for POST /sales and held bills (price only sent when overridden). */
export function saleLines(lines: CartLine[]) {
  return lines.map((l) => ({
    variantId: l.hit.variantId, qty: l.qty, discount: l.discount, batchId: l.batchId,
    ...(l.serials.length ? { serials: l.serials } : {}),
    ...(l.unitPrice !== l.hit.salePrice ? { unitPrice: l.unitPrice } : {}),
  }));
}

export type TenderMethod = "cash" | "card" | "upi" | "credit";
export interface Tender { method: TenderMethod; amount: number; reference: string }

/** Is this payment acceptable for the bill? Same rules as the server's checkout. */
export function checkTenders(total: number, tenders: { method: TenderMethod; amount: number }[], hasCustomer: boolean) {
  const valid = tenders.every((t) => Number.isFinite(t.amount) && t.amount >= 0);
  const paid = tenders.reduce((a, t) => a + (Number.isFinite(t.amount) ? t.amount : 0), 0);
  const cash = tenders.filter((t) => t.method === "cash").reduce((a, t) => a + (Number.isFinite(t.amount) ? t.amount : 0), 0);
  const remaining = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  let problem: string | null = null;
  if (!valid) problem = "Check the amounts.";
  else if (paid < total) problem = "The payment doesn't cover the bill.";
  else if (change > cash) problem = "Only cash can be overpaid (as change).";
  else if (tenders.some((t) => t.method === "credit" && t.amount > 0) && !hasCustomer) problem = "Choose a customer to put this on their account.";
  return { paid, cash, remaining, change, problem };
}

/** Handy cash amounts: exact, then the next round notes. */
export function quickCash(total: number) {
  const notes = [1000, 5000, 10000, 20000, 50000, 100000, 200000];
  const out = new Set<number>([total]);
  for (const n of notes) {
    const v = Math.ceil(total / n) * n;
    if (v > total) out.add(v);
    if (out.size >= 5) break;
  }
  return [...out];
}
