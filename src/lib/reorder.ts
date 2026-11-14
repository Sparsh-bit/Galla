export interface ReorderItem {
  variantId: string;
  name: string; // product and portion, ready to show
  unit: string;
  /** In stock now, in the item's own unit (kg, not grams). */
  inStock: number;
  /** How many to order, in the item's own unit. */
  suggest: number;
  /** Cost on the last purchase, in minor units, or null. */
  lastCost: number | null;
}
export interface ReorderGroup {
  supplierId: string | null;
  supplierName: string;
  phone: string;
  items: ReorderItem[];
}

/** Enough to get back to twice the reorder level, at least one unit. */
export function suggestQty(reorderLevel: number, inStock: number): number {
  return Math.max(1, Math.ceil(reorderLevel * 2 - inStock));
}

const num = (n: number) => String(+n.toFixed(3));

/** The WhatsApp message to a supplier: a plain numbered list they can answer line by line. */
export function reorderMessage(shop: string, supplier: string, items: { name: string; qty: number; unit: string }[]): string {
  const lines = items.filter((i) => i.qty > 0).map((i, n) => `${n + 1}. ${i.name} - ${num(i.qty)} ${i.unit}`);
  return [`Hello${supplier ? ` ${supplier}` : ""},`, `Please send the following to ${shop}:`, "", ...lines, "", "Please confirm the rate and delivery date. Thank you."].join("\n");
}
