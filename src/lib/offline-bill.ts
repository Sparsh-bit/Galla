// Bills made on an offline till: number, tax, receipt and the payload synced later.
// Shared by the web POS and the Android app so an offline bill is identical on every device, and
// identical to what the server re-checks on sync (services/offline.ts uses the same tax engine).
import { fiscalYear, offlineNumber } from "./numbering";
import type { ReceiptData } from "./receipt";
import { computeBill } from "./tax";

export interface OfflineBillSettings {
  orgName: string; legalName: string; address: string; phone: string; email: string; taxId: string;
  taxMode: "GST" | "VAT" | "NONE"; stateCode: string; roundOff: boolean; currency: string; locale: string; timezone: string;
  fiscalYearStartMonth: number;
  prefixes: { sale: string; invoice: string };
  receipt: { paperWidth: 58 | 80; header: string; footer: string; showHsn: boolean; upiId: string; showUpiQr: boolean };
  logoUrl: string | null;
}

export interface OfflineItem {
  variantId: string; name: string; variantName: string; sku: string; hsn: string; unit: string;
  scale: number; mrp: number; rateBp: number; cessBp: number; inclusive: boolean;
}

export interface OfflineBillLine {
  hit: OfflineItem;
  qty: number;
  unitPrice: number;
  discount: number;
  serials: string[];
}

export interface OfflineCustomer {
  id: string; name: string; phone: string; stateCode: string; taxId: string;
}

export type OfflinePaymentMethod = "cash" | "card" | "upi" | "credit" | "other";

export interface OfflineBillInput {
  settings: OfflineBillSettings;
  tillCode: string;
  /** Next number in this till's series for `offlineSeries(...).key`. */
  seq: number;
  now: Date;
  clientId: string;
  locationId: string;
  cashierName: string;
  kind: "receipt" | "tax_invoice";
  customer: OfflineCustomer | null;
  billDiscount: number;
  lines: OfflineBillLine[];
  payments: { method: OfflinePaymentMethod; amount: number; reference: string }[];
}

/** What the server's /pos/offline-sales accepts for one bill. */
export interface OfflineSalePayload {
  clientId: string; number: string; createdAt: string; locationId: string; customerId: string | null;
  kind: "receipt" | "tax_invoice"; billDiscount: number; notes: string;
  lines: { variantId: string; qty: number; unitPrice: number; discount: number; serials: string[] }[];
  payments: { method: OfflinePaymentMethod; amount: number; reference: string }[];
  grandTotal: number;
}

/** The till series a bill of this kind falls in today (its counter key, prefix and fiscal year). */
export function offlineSeries(settings: OfflineBillSettings, kind: "receipt" | "tax_invoice", now: Date) {
  const fy = fiscalYear(now, settings.fiscalYearStartMonth, settings.timezone);
  const prefix = kind === "tax_invoice" ? settings.prefixes.invoice : settings.prefixes.sale;
  return { key: `${prefix}:${fy}`, prefix, fy };
}

export function buildOfflineBill(o: OfflineBillInput): { number: string; total: number; receipt: ReceiptData; payload: OfflineSalePayload } {
  const s = o.settings;
  const { prefix, fy } = offlineSeries(s, o.kind, o.now);
  const number = offlineNumber(prefix, o.tillCode, fy, o.seq);
  const interState = s.taxMode === "GST" && !!o.customer?.stateCode && !!s.stateCode && o.customer.stateCode !== s.stateCode;
  const bill = computeBill({
    lines: o.lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty, scale: l.hit.scale, discount: l.discount, rateBp: l.hit.rateBp, cessBp: l.hit.cessBp, inclusive: l.hit.inclusive })),
    billDiscount: o.billDiscount, mode: s.taxMode, interState, roundOff: s.roundOff,
  });
  const payments = o.payments.filter((p) => p.amount > 0);
  const tendered = payments.reduce((a, p) => a + p.amount, 0);
  const cash = payments.filter((p) => p.method === "cash").reduce((a, p) => a + p.amount, 0);
  const credit = payments.filter((p) => p.method === "credit").reduce((a, p) => a + p.amount, 0);
  const change = Math.min(cash, Math.max(0, tendered - bill.grandTotal));
  const balanceDue = Math.max(0, bill.grandTotal - (tendered - credit - change));

  const summary = new Map<number, { rateBp: number; taxable: number; cgst: number; sgst: number; igst: number; vat: number; cess: number }>();
  bill.lines.forEach((bl, i) => {
    const rateBp = o.lines[i].hit.rateBp;
    const r = summary.get(rateBp) ?? { rateBp, taxable: 0, cgst: 0, sgst: 0, igst: 0, vat: 0, cess: 0 };
    r.taxable += bl.taxable; r.cgst += bl.cgst; r.sgst += bl.sgst; r.igst += bl.igst; r.vat += bl.vat; r.cess += bl.cess;
    summary.set(rateBp, r);
  });

  const receipt: ReceiptData = {
    org: {
      name: s.orgName, legalName: s.legalName, address: s.address, phone: s.phone, email: s.email, taxId: s.taxId, taxMode: s.taxMode, logoUrl: s.logoUrl,
      header: s.receipt.header, footer: s.receipt.footer, terms: "", upiId: s.receipt.upiId, showUpiQr: s.receipt.showUpiQr, showHsn: s.receipt.showHsn,
      currency: s.currency, locale: s.locale, timezone: s.timezone, paperWidth: s.receipt.paperWidth,
    },
    sale: {
      id: o.clientId, number, kind: o.kind, status: "completed", cashier: o.cashierName, location: "",
      date: o.now.toLocaleString(s.locale, { timeZone: s.timezone, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      customer: o.customer ? { name: o.customer.name, phone: o.customer.phone, taxId: o.customer.taxId, address: "" } : null,
      placeOfSupply: o.customer?.stateCode || s.stateCode, interState,
      lines: o.lines.map((l, i) => ({
        name: [l.hit.name, l.hit.variantName].filter(Boolean).join(" - "), sku: l.hit.sku, hsn: l.hit.hsn, qty: l.qty, scale: l.hit.scale, unit: l.hit.unit, unitPrice: l.unitPrice,
        mrp: l.hit.mrp, discount: bill.lines[i].discount, taxable: bill.lines[i].taxable, rateBp: l.hit.rateBp, tax: bill.lines[i].tax, total: bill.lines[i].total, batchNo: "", serials: l.serials,
      })),
      subtotal: bill.subtotal, discountTotal: bill.discountTotal, taxableTotal: bill.taxableTotal, cgst: bill.cgst, sgst: bill.sgst, igst: bill.igst, vat: bill.vat, cess: bill.cess,
      taxTotal: bill.taxTotal, roundOff: bill.roundOff, grandTotal: bill.grandTotal, payments, change,
      balanceDue: o.customer ? balanceDue : 0, returnOfNumber: null, notes: "", taxSummary: [...summary.values()].filter((t) => t.cgst || t.sgst || t.igst || t.vat || t.cess),
    },
  };

  const payload: OfflineSalePayload = {
    clientId: o.clientId, number, createdAt: o.now.toISOString(), locationId: o.locationId, customerId: o.customer?.id ?? null, kind: o.kind, billDiscount: o.billDiscount, notes: "",
    lines: o.lines.map((l) => ({ variantId: l.hit.variantId, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, serials: l.serials })),
    payments, grandTotal: bill.grandTotal,
  };
  return { number, total: bill.grandTotal, receipt, payload };
}

/** The till's catalogue after a sale: less stock, sold serials gone (so the next offline bill sees them). */
export function applyOfflineSale<S extends { variants: { variantId: string; stock: number }[]; serials: { serial: string }[] }>(snapshot: S, lines: { hit: { variantId: string }; qty: number; serials: string[] }[]): S {
  const sold = new Set(lines.flatMap((l) => l.serials));
  const qty = new Map<string, number>();
  for (const l of lines) qty.set(l.hit.variantId, (qty.get(l.hit.variantId) ?? 0) + l.qty);
  return {
    ...snapshot,
    variants: snapshot.variants.map((v) => (qty.has(v.variantId) ? { ...v, stock: v.stock - qty.get(v.variantId)! } : v)),
    serials: snapshot.serials.filter((x) => !sold.has(x.serial)),
  };
}

/** Barcode/SKU/serial lookup in a till snapshot (same rules as the server's findByCode). */
export function lookupInSnapshot<V extends { variantId: string; barcode: string; sku: string }>(snapshot: { variants: V[]; serials: { serial: string; variantId: string }[] }, code: string): (V & { serial?: string }) | null {
  const c = code.trim();
  const hit = snapshot.variants.find((v) => v.barcode === c || v.sku === c);
  if (hit) return hit;
  const sn = snapshot.serials.find((s) => s.serial === c);
  const v = sn && snapshot.variants.find((x) => x.variantId === sn.variantId);
  return v ? { ...v, serial: sn.serial } : null;
}

export function searchSnapshot<V extends { name: string; variantName: string; sku: string; barcode: string }>(variants: V[], q: string, limit = 40): V[] {
  const t = q.trim().toLowerCase();
  return variants.filter((v) => !t || v.name.toLowerCase().includes(t) || v.variantName.toLowerCase().includes(t) || v.sku.toLowerCase().includes(t) || v.barcode === q.trim()).slice(0, limit);
}
