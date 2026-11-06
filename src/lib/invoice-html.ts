import { formatMoney } from "./money";
import { pct, qtyText, receiptTitle, type ReceiptData } from "./receipt";
import { INDIAN_STATES } from "./schemas";

// A4 tax invoice as a self-contained HTML document (no scripts, every value escaped). The Android
// app prints it through the system print service; the web's /print/invoice page shows the same
// fields and wording.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const stateName = (code: string) => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code;

/** Spells an amount in words (Indian numbering for INR, international otherwise). */
export function amountInWords(minor: number, currency: string): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`);
  const three = (n: number) => [n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred` : "", two(n % 100)].filter(Boolean).join(" ");
  const words = (n: number): string => {
    if (n === 0) return "Zero";
    const parts: string[] = [];
    const units: [number, string][] = currency === "INR" ? [[1e7, "Crore"], [1e5, "Lakh"], [1e3, "Thousand"]] : [[1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"]];
    for (const [v, name] of units) {
      if (n >= v) {
        parts.push(`${words(Math.floor(n / v))} ${name}`);
        n %= v;
      }
    }
    if (n) parts.push(three(n));
    return parts.join(" ");
  };
  const major = Math.floor(Math.abs(minor) / 100);
  const cents = Math.abs(minor) % 100;
  const [big, small] = currency === "INR" ? ["Rupees", "Paise"] : [currency, "cents"];
  return `${big} ${words(major)}${cents ? ` and ${two(cents)} ${small}` : ""} Only`;
}

/** `irnQrSvg` / `upiQrSvg`: inline SVG markup from a trusted QR generator (not user text). */
export function invoiceHtml(d: ReceiptData, opts: { irnQrSvg?: string | null; upiQrSvg?: string | null; logoUrl?: string | null } = {}): string {
  const m = (v: number) => esc(formatMoney(v, d.org.currency, d.org.locale));
  const gst = d.org.taxMode === "GST";
  const s = d.sale;
  const lines = s.lines
    .map(
      (l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}${l.batchNo ? `<div class="mu">Batch ${esc(l.batchNo)}</div>` : ""}${l.serials.length ? `<div class="mu">S/N: ${esc(l.serials.join(", "))}</div>` : ""}</td>${gst ? `<td>${esc(l.hsn || "—")}</td>` : ""}<td class="r">${esc(qtyText(l.qty, l.scale))} ${esc(l.unit)}</td><td class="r">${m(l.unitPrice)}</td><td class="r">${l.discount ? m(l.discount) : "—"}</td><td class="r">${m(l.taxable)}</td><td class="r">${l.rateBp ? `${m(l.tax)} (${pct(l.rateBp)})` : "—"}</td><td class="r b">${m(l.total)}</td></tr>`,
    )
    .join("");
  const taxHead = gst ? (s.interState ? "<th class='r'>IGST</th>" : "<th class='r'>CGST</th><th class='r'>SGST</th>") : "<th class='r'>Tax</th>";
  const taxRows = s.taxSummary
    .map((t) => `<tr><td>${pct(t.rateBp)}</td><td class="r">${m(t.taxable)}</td>${gst ? (s.interState ? `<td class="r">${m(t.igst)}</td>` : `<td class="r">${m(t.cgst)}</td><td class="r">${m(t.sgst)}</td>`) : `<td class="r">${m(t.vat)}</td>`}${s.cess > 0 ? `<td class="r">${m(t.cess)}</td>` : ""}</tr>`)
    .join("");
  const total = (k: string, v: string, cls = "") => `<div class="tl ${cls}"><span>${k}</span><span>${v}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.number)}</title><style>
@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;font:12px/1.5 -apple-system,Roboto,"Segoe UI",Arial,sans-serif;color:#000}
h1{font-size:19px;margin:0}.r{text-align:right;white-space:nowrap}.b{font-weight:600}.mu{color:#666;font-size:10.5px}.red{color:#c00;font-weight:bold}
header{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #ddd;padding-bottom:12px}header img{width:64px;height:64px;object-fit:contain;margin-right:12px}
.cols{display:flex;justify-content:space-between;gap:24px;padding:12px 0}.lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#666}
table{width:100%;border-collapse:collapse}.items th{background:#f6f6f6;text-align:left;font-size:11px;padding:6px;border-top:1px solid #ddd;border-bottom:1px solid #ddd}.items td{padding:6px;border-bottom:1px solid #eee;vertical-align:top;font-size:11px}
.sum{display:flex;gap:32px;margin-top:16px}.sum>div:first-child{flex:1}.sum>div:last-child{width:260px}.tl{display:flex;justify-content:space-between;padding:2px 0}.gt{border-top:1px solid #ccc;border-bottom:1px solid #ccc;padding:6px 0;font-size:14px;font-weight:bold}
.tax th,.tax td{font-size:10.5px;padding:3px 0;border-bottom:1px solid #eee}.tax th{color:#666;text-align:left}.qr{display:flex;align-items:center;gap:12px}.qr svg{width:96px;height:96px}.irn svg{width:110px;height:110px}
footer{margin-top:48px;display:flex;justify-content:space-between;align-items:flex-end}.sign{text-align:center;border-top:1px solid #ccc;padding-top:4px}</style></head><body>
<header><div style="display:flex">${opts.logoUrl ? `<img src="${esc(opts.logoUrl)}" alt="">` : ""}<div><h1>${esc(d.org.legalName || d.org.name)}</h1>${d.org.address ? `<div>${esc(d.org.address)}</div>` : ""}<div>${esc([d.org.phone, d.org.email].filter(Boolean).join(" · "))}</div>${d.org.taxId ? `<div class="b">${gst ? "GSTIN" : "Tax No"}: ${esc(d.org.taxId)}</div>` : ""}</div></div>
<div class="r"><div style="font-size:17px;font-weight:bold;letter-spacing:.04em">${esc(receiptTitle(d))}</div>${s.status === "void" ? `<div class="red">VOID</div>` : ""}<div>No: <b>${esc(s.number)}</b></div><div>Date: ${esc(s.date)}</div>${s.returnOfNumber ? `<div>Against invoice: ${esc(s.returnOfNumber)}</div>` : ""}</div></header>
${s.einvoice ? `<section class="cols irn" style="border-bottom:1px solid #ddd;font-size:10.5px"><div>${s.einvoice.cancelled ? `<div class="red">IRN CANCELLED</div>` : ""}<div><span class="mu">IRN:</span> <span style="word-break:break-all;font-family:monospace">${esc(s.einvoice.irn)}</span></div><div><span class="mu">Ack No:</span> ${esc(s.einvoice.ackNo)} · <span class="mu">Ack Date:</span> ${esc(s.einvoice.ackDt)}</div>${s.einvoice.ewbNo ? `<div><span class="mu">E-way bill:</span> ${esc(s.einvoice.ewbNo)}</div>` : ""}</div>${opts.irnQrSvg ?? ""}</section>` : ""}
<section class="cols"><div><div class="lbl">Bill to</div>${s.customer ? `<div class="b">${esc(s.customer.name)}</div>${s.customer.address ? `<div>${esc(s.customer.address)}</div>` : ""}${s.customer.phone ? `<div>${esc(s.customer.phone)}</div>` : ""}${s.customer.taxId ? `<div>GSTIN: ${esc(s.customer.taxId)}</div>` : ""}` : "<div>Cash customer</div>"}</div>
${gst ? `<div class="r"><div class="lbl">Place of supply</div><div>${s.placeOfSupply ? `${esc(stateName(s.placeOfSupply))} (${esc(s.placeOfSupply)})` : "—"}</div><div class="mu">${s.interState ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"}</div></div>` : ""}</section>
<table class="items"><thead><tr><th>#</th><th>Item</th>${gst ? "<th>HSN/SAC</th>" : ""}<th class="r">Qty</th><th class="r">Rate</th><th class="r">Disc.</th><th class="r">Taxable</th><th class="r">Tax</th><th class="r">Amount</th></tr></thead><tbody>${lines}</tbody></table>
<section class="sum"><div>${taxRows ? `<table class="tax"><thead><tr><th>Rate</th><th class="r">Taxable</th>${taxHead}${s.cess > 0 ? "<th class='r'>Cess</th>" : ""}</tr></thead><tbody>${taxRows}</tbody></table>` : ""}
<p><span class="mu">Amount in words:</span> ${esc(amountInWords(s.grandTotal, d.org.currency))}</p>${d.org.terms ? `<div class="mu" style="white-space:pre-line"><b style="color:#000">Terms &amp; conditions</b><br>${esc(d.org.terms)}</div>` : ""}
${opts.upiQrSvg ? `<div class="qr">${opts.upiQrSvg}<div class="mu">Scan with any UPI app to pay ${m(s.balanceDue)}<br>UPI ID: ${esc(d.org.upiId)}</div></div>` : ""}</div>
<div>${total("Subtotal", m(s.subtotal))}${s.discountTotal > 0 ? total("Discount", `−${m(s.discountTotal)}`) : ""}${total("Taxable value", m(s.taxableTotal))}${total("Total tax", m(s.taxTotal))}${s.roundOff !== 0 ? total("Round off", m(s.roundOff)) : ""}${total("Grand total", m(s.grandTotal), "gt")}${total("Paid", m(s.grandTotal - s.balanceDue))}${s.balanceDue > 0 ? total("Balance due", m(s.balanceDue), "b") : ""}</div></section>
<footer><div class="mu" style="font-size:10px">${esc(d.org.footer)}</div><div class="sign"><div style="height:40px"></div>For ${esc(d.org.legalName || d.org.name)}<br><span class="mu">Authorised signatory</span></div></footer>
</body></html>`;
}
