import "server-only";
import { headers } from "next/headers";
import { can, seesCost } from "@/lib/permissions";
import { auth } from "../auth";
import { AppError, getOrgSettings, type Ctx } from "../context";
import { connectDb } from "../db";
import { AuditLog, Category, EinvoiceConfig, Location, Party, Product, PurchaseOrder, Sale, SerialNumber, StockLevel, StockMove, TaxRate, Types, type ProductDoc, type SaleDoc } from "../models";
import { getReceiptData } from "../services/receipt";
import { getEinvoiceSettings } from "../services/einvoice";
import { partyStatement } from "../services/ledger";
import {
  balances, expiringBatches, gstSummary, lowStock, parseRange, purchaseTotals, salesByCashier, salesByCategory, salesByDay, salesByPayment, salesByProduct, salesTotals, startOfDay, stockValuation,
} from "../services/reports";
import { stockByVariant } from "../services/stock";

// Read side of the REST API. Each query mirrors what the matching screen shows, with the same
// permission rules (cost prices are hidden from roles that can't see them).

export type Query = Record<string, string | undefined>;
const PAGE = 25;
const page = (q: Query) => Math.max(1, Math.min(10_000, Number.parseInt(q.page ?? "1", 10) || 1));
const text = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max);
const rx = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const isId = (s: string | undefined): s is string => !!s && /^[a-f0-9]{24}$/i.test(s);
const paged = <T>(items: T[], total: number, p: number) => ({ items, total, page: p, pageSize: PAGE, pages: Math.max(1, Math.ceil(total / PAGE)) });
function need(ctx: Ctx, perm: Parameters<typeof can>[1]) {
  if (!can(ctx.role, perm)) throw new AppError("FORBIDDEN", "You don't have permission to do that.");
}

function stripCost(ctx: Ctx, p: ProductDoc) {
  return seesCost(ctx.role) ? p : { ...p, variants: p.variants.map((v) => ({ ...v, costPrice: 0 })) };
}

/* ---------------- session ---------------- */

export async function me(ctx: Ctx) {
  const [s, session] = await Promise.all([getOrgSettings(ctx.orgId), auth.api.getSession({ headers: await headers() })]);
  const { connection } = await connectDb();
  const orgs = await connection.db!
    .collection("member")
    .aggregate<{ id: string; name: string; role: string }>([
      { $match: { userId: new Types.ObjectId(ctx.userId) } },
      { $lookup: { from: "organization", localField: "organizationId", foreignField: "_id", as: "o" } },
      { $unwind: "$o" },
      { $project: { _id: 0, id: { $toString: "$o._id" }, name: "$o.name", role: 1 } },
    ])
    .toArray();
  return {
    user: { id: ctx.userId, name: ctx.userName, email: ctx.userEmail, twoFactorEnabled: !!(session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled },
    business: {
      id: ctx.orgId, name: ctx.orgName, role: ctx.role, currency: s.currency, locale: s.locale, timezone: s.timezone, taxMode: s.taxMode as "GST" | "VAT" | "NONE",
      // What a till needs to bill exactly like the web POS.
      stateCode: s.stateCode ?? "", roundOff: !!s.roundOff, pricesIncludeTax: !!s.pricesIncludeTax, allowNegativeStock: !!s.allowNegativeStock,
      fiscalYearStartMonth: s.fiscalYearStartMonth, logoUrl: s.logoUrl ?? null,
      receipt: { paperWidth: (s.receipt?.paperWidth ?? 80) as 58 | 80, upiId: s.receipt?.upiId ?? "", showUpiQr: !!s.receipt?.showUpiQr },
      scanner: { interKeyMs: s.scanner?.interKeyMs ?? 35, minLength: s.scanner?.minLength ?? 4 },
    },
    businesses: orgs,
  };
}

/* ---------------- dashboard & reports ---------------- */

export async function dashboard(ctx: Ctx) {
  const s = await getOrgSettings(ctx.orgId);
  const today = startOfDay(s.timezone);
  const tomorrow = new Date(today.getTime() + 86400e3);
  const yesterday = new Date(today.getTime() - 86400e3);
  const monthAgo = new Date(today.getTime() - 29 * 86400e3);
  const money = can(ctx.role, "reports:read");
  const [t, y, series, top, low, expiring, receivables, recent] = await Promise.all([
    salesTotals(ctx, today, tomorrow),
    salesTotals(ctx, yesterday, today),
    money ? salesByDay(ctx, s.timezone, monthAgo, tomorrow) : Promise.resolve([]),
    money ? salesByProduct(ctx, monthAgo, tomorrow, 5) : Promise.resolve([]),
    lowStock(ctx, 8),
    expiringBatches(ctx, 30),
    money ? balances(ctx, "customer") : Promise.resolve({ rows: [], total: 0 }),
    Sale.find({ orgId: ctx.orgId, status: "completed" }, { number: 1, grandTotal: 1, completedAt: 1, kind: 1, customer: 1, cashierName: 1 }).sort({ completedAt: -1 }).limit(6).lean(),
  ]);
  return {
    // Same rule as the dashboard screen: everyone sees sales; profit and dues need reports access.
    today: money ? t : { revenue: t.revenue, count: t.count, avgBill: t.avgBill, returnCount: t.returnCount },
    yesterday: money ? y : { revenue: y.revenue, count: y.count },
    last30Days: series,
    topProducts: top,
    lowStock: low,
    expiring,
    receivables: money ? receivables : null,
    recentSales: recent,
  };
}

export async function reports(ctx: Ctx, q: Query) {
  need(ctx, "reports:read");
  const s = await getOrgSettings(ctx.orgId);
  const r = parseRange(s.timezone, q.from, q.to);
  const [totals, byDay, byProduct, byPayment, byCashier, byCategory, purchases, gst, stock, expiry, receivables, payables] = await Promise.all([
    salesTotals(ctx, r.start, r.end), salesByDay(ctx, s.timezone, r.start, r.end), salesByProduct(ctx, r.start, r.end, 25), salesByPayment(ctx, r.start, r.end),
    salesByCashier(ctx, r.start, r.end), salesByCategory(ctx, r.start, r.end), purchaseTotals(ctx, r.start, r.end), gstSummary(ctx, r.start, r.end),
    stockValuation(ctx), expiringBatches(ctx, 90), balances(ctx, "customer"), balances(ctx, "supplier"),
  ]);
  return { range: { from: r.from, to: r.to }, totals, byDay, byProduct, byPayment, byCashier, byCategory, purchases, gst, stock, expiry, receivables, payables };
}

/* ---------------- products ---------------- */

export async function listProducts(ctx: Ctx, q: Query) {
  need(ctx, "products:read");
  const p = page(q);
  const filter: Record<string, unknown> = { orgId: ctx.orgId, active: q.status !== "archived" };
  const s = text(q.q, 80);
  if (s) filter.$or = [{ name: rx(s) }, { brand: rx(s) }, { "variants.sku": rx(s) }, { "variants.barcodes": s }];
  if (isId(q.category)) filter.categoryId = q.category;
  const [rows, total] = await Promise.all([
    Product.find(filter).sort({ name: 1 }).skip((p - 1) * PAGE).limit(PAGE).lean<ProductDoc[]>(),
    Product.countDocuments(filter),
  ]);
  const stock = await stockByVariant(ctx, rows.flatMap((r) => r.variants.map((v) => String(v._id))));
  return paged(rows.map((r) => ({ ...stripCost(ctx, r), stock: Object.fromEntries(r.variants.map((v) => [String(v._id), stock.get(String(v._id)) ?? 0])) })), total, p);
}

export async function getProduct(ctx: Ctx, id: string) {
  need(ctx, "products:read");
  const p = isId(id) ? await Product.findOne({ orgId: ctx.orgId, _id: id }).lean<ProductDoc>() : null;
  if (!p) throw new AppError("NOT_FOUND", "Not found");
  const [levels, moves] = await Promise.all([
    StockLevel.find({ orgId: ctx.orgId, productId: p._id }).lean(),
    StockMove.find({ orgId: ctx.orgId, productId: p._id }).sort({ createdAt: -1 }).limit(12).lean(),
  ]);
  return { product: stripCost(ctx, p), stockLevels: levels, recentMoves: moves };
}

export async function productFormData(ctx: Ctx) {
  need(ctx, "products:read");
  const [categories, taxRates, locations, settings] = await Promise.all([
    Category.find({ orgId: ctx.orgId }).sort({ name: 1 }).lean(),
    TaxRate.find({ orgId: ctx.orgId }).sort({ rateBp: 1, cessBp: 1 }).lean(),
    Location.find({ orgId: ctx.orgId, active: true }).sort({ isDefault: -1, name: 1 }).lean(),
    getOrgSettings(ctx.orgId),
  ]);
  const def = taxRates.find((t) => t.isDefault);
  return {
    categories: categories.map((c) => ({ id: String(c._id), name: c.name, parentId: c.parentId ? String(c.parentId) : null })),
    taxRates: taxRates.map((t) => ({ id: String(t._id), name: t.name, rateBp: t.rateBp, cessBp: t.cessBp ?? 0, isDefault: !!t.isDefault })),
    locations: locations.map((l) => ({ id: String(l._id), name: l.name, isDefault: l.isDefault })),
    defaults: { priceIncludesTax: settings.pricesIncludeTax, taxRateId: def ? String(def._id) : null },
  };
}

export async function listCategories(ctx: Ctx) {
  need(ctx, "products:read");
  return Category.find({ orgId: ctx.orgId }).sort({ name: 1 }).lean();
}

export async function listLocations(ctx: Ctx) {
  return Location.find({ orgId: ctx.orgId }).sort({ isDefault: -1, name: 1 }).lean();
}

/* ---------------- inventory ---------------- */

export async function listStock(ctx: Ctx, q: Query) {
  need(ctx, "stock:read");
  const p = page(q);
  const locationId = isId(q.location) ? q.location : null;
  const filter: Record<string, unknown> = { orgId: ctx.orgId, active: true };
  const s = text(q.q, 60);
  if (s) filter.$or = [{ name: rx(s) }, { "variants.sku": rx(s) }, { "variants.barcodes": s }];
  if (q.filter === "low") filter["variants._id"] = { $in: (await lowStock(ctx, 2000)).map((r) => r.variantId) };
  const [rows, total] = await Promise.all([
    Product.find(filter, { name: 1, unit: 1, reorderLevel: 1, variants: 1, trackBatch: 1 }).sort({ name: 1 }).skip((p - 1) * PAGE).limit(PAGE).lean<ProductDoc[]>(),
    Product.countDocuments(filter),
  ]);
  const match: Record<string, unknown> = { orgId: new Types.ObjectId(ctx.orgId), variantId: { $in: rows.flatMap((r) => r.variants.map((v) => v._id)) } };
  if (locationId) match.locationId = new Types.ObjectId(locationId);
  const levels = await StockLevel.aggregate<{ _id: { v: Types.ObjectId; l: Types.ObjectId }; qty: number }>([{ $match: match }, { $group: { _id: { v: "$variantId", l: "$locationId" }, qty: { $sum: "$qty" } } }]);
  const items = rows.map((r) => ({
    ...stripCost(ctx, r),
    stock: r.variants.map((v) => ({
      variantId: String(v._id),
      byLocation: levels.filter((x) => String(x._id.v) === String(v._id)).map((x) => ({ locationId: String(x._id.l), qty: x.qty })),
    })),
  }));
  return { ...paged(items, total, p), lowStockCount: (await lowStock(ctx, 2000)).length };
}

export async function listMoves(ctx: Ctx, q: Query) {
  need(ctx, "stock:read");
  const s = await getOrgSettings(ctx.orgId);
  const r = parseRange(s.timezone, q.from, q.to);
  const p = page(q);
  const filter: Record<string, unknown> = { orgId: ctx.orgId, createdAt: { $gte: r.start, $lt: r.end } };
  if (q.type && /^[a-z_]{2,20}$/.test(q.type)) filter.type = q.type;
  if (isId(q.product)) {
    filter.productId = q.product;
    delete filter.createdAt;
  }
  const [rows, total] = await Promise.all([StockMove.find(filter).sort({ createdAt: -1 }).skip((p - 1) * PAGE).limit(PAGE).lean(), StockMove.countDocuments(filter)]);
  // Name and unit of each product, so a movement can be shown on its own (kg items in kg, not grams).
  const products = await Product.find({ orgId: ctx.orgId, _id: { $in: [...new Set(rows.map((m) => String(m.productId)))] } }, { name: 1, unit: 1, variants: { _id: 1, name: 1 } }).lean();
  const info = (m: (typeof rows)[number]) => {
    const pr = products.find((x) => String(x._id) === String(m.productId));
    const v = pr?.variants.find((x) => String(x._id) === String(m.variantId));
    return { name: [pr?.name, v?.name].filter(Boolean).join(" - ") || "Deleted item", unit: pr?.unit?.code ?? "", scale: pr?.unit?.scale ?? 1 };
  };
  const items = rows.map((m) => ({ ...m, unitCost: seesCost(ctx.role) ? m.unitCost : 0, product: info(m) }));
  return { ...paged(items, total, p), range: { from: r.from, to: r.to } };
}

export async function listSerials(ctx: Ctx, q: Query) {
  need(ctx, "stock:read");
  const p = page(q);
  const filter: Record<string, unknown> = { orgId: ctx.orgId };
  const s = text(q.q, 64);
  if (s) filter.serial = new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  if (q.status && /^[a-z_]{2,20}$/.test(q.status)) filter.status = q.status;
  const [rows, total] = await Promise.all([SerialNumber.find(filter).sort({ updatedAt: -1 }).skip((p - 1) * PAGE).limit(PAGE).lean(), SerialNumber.countDocuments(filter)]);
  return paged(rows, total, p);
}

/* ---------------- sales ---------------- */

export async function listSales(ctx: Ctx, q: Query) {
  need(ctx, "sales:read");
  const s = await getOrgSettings(ctx.orgId);
  const r = parseRange(s.timezone, q.from, q.to);
  const p = page(q);
  const filter: Record<string, unknown> = { orgId: ctx.orgId, status: { $in: ["completed", "void"] }, completedAt: { $gte: r.start, $lt: r.end } };
  const t = text(q.q, 60);
  if (t) filter.$or = [{ number: rx(t) }, { "customer.name": rx(t) }, { "customer.phone": rx(t) }];
  if (q.type === "return") filter.kind = "return";
  else if (q.type === "credit") filter.balanceDue = { $gt: 0 };
  else if (q.type === "void") filter.status = "void";
  else if (q.type === "invoice") filter.kind = "tax_invoice";
  else if (q.type === "review") filter["syncIssues.0"] = { $exists: true };
  const [rows, total] = await Promise.all([
    Sale.find(filter, { number: 1, kind: 1, status: 1, completedAt: 1, customer: 1, grandTotal: 1, balanceDue: 1, payments: 1, cashierName: 1, deviceCode: 1, syncIssues: 1 }).sort({ completedAt: -1 }).skip((p - 1) * PAGE).limit(PAGE).lean(),
    Sale.countDocuments(filter),
  ]);
  return { ...paged(rows, total, p), range: { from: r.from, to: r.to } };
}

/** Everything the bill screen shows (same rules as the web's /sales/[id] page). */
export async function saleDetail(ctx: Ctx, saleId: string) {
  need(ctx, "sales:read");
  const sale = isId(saleId) ? await Sale.findOne({ orgId: ctx.orgId, _id: saleId, status: { $in: ["completed", "void"] } }).lean<SaleDoc>() : null;
  if (!sale) throw new AppError("NOT_FOUND", "Not found");
  const s = await getOrgSettings(ctx.orgId);
  const isReturn = sale.kind === "return";
  const einvoiceEligible = s.taxMode === "GST" && sale.status === "completed" && !!sale.customer?.taxId;
  const [receipt, loc, returns, original, einv] = await Promise.all([
    getReceiptData(ctx, saleId),
    Location.findOne({ orgId: ctx.orgId, _id: sale.locationId }, { name: 1 }).lean(),
    Sale.find({ orgId: ctx.orgId, returnOf: sale._id }, { number: 1, grandTotal: 1, completedAt: 1 }).lean(),
    sale.returnOf ? Sale.findOne({ orgId: ctx.orgId, _id: sale.returnOf }, { number: 1 }).lean() : null,
    einvoiceEligible ? EinvoiceConfig.findOne({ orgId: ctx.orgId }, { enabled: 1 }).lean() : null,
  ]);
  const returnable = !isReturn && sale.status === "completed" && sale.lines.some((l) => l.qty - (l.returnedQty ?? 0) > 0);
  return {
    receipt,
    customerId: sale.customerId ? String(sale.customerId) : null,
    location: loc?.name ?? "",
    completedAt: sale.completedAt ?? null,
    deviceCode: sale.deviceCode ?? null,
    lines: sale.lines.map((l, i) => ({ index: i, sold: l.qty, returned: l.returnedQty ?? 0, serials: l.serials ?? [] })),
    syncIssues: (sale.syncIssues ?? []).map((i) => ({ code: i.code ?? "", message: i.message ?? "" })),
    returns: returns.map((r) => ({ id: String(r._id), number: r.number ?? "", total: r.grandTotal ?? 0, at: r.completedAt ?? null })),
    returnOf: original ? { id: String(original._id), number: original.number ?? "" } : null,
    canReturn: returnable && can(ctx.role, "sales:return"),
    canVoid: !isReturn && sale.status === "completed" && can(ctx.role, "sales:void"),
    einvoice: { eligible: einvoiceEligible, enabled: !!einv?.enabled, canManage: can(ctx.role, "sales:void") },
  };
}

/* ---------------- customers, suppliers, khata ---------------- */

const partyPerm = (kind: "customer" | "supplier") => (kind === "customer" ? "parties:read" : "purchases:read");

export async function listParties(ctx: Ctx, kind: "customer" | "supplier", q: Query) {
  need(ctx, partyPerm(kind));
  const p = page(q);
  const filter: Record<string, unknown> = { orgId: ctx.orgId, kind, active: true };
  const s = text(q.q, 60);
  if (s) filter.$or = [{ name: rx(s) }, { phone: rx(s) }, { taxId: rx(s) }, { email: rx(s) }];
  if (q.due === "1") filter.balance = { $gt: 0 };
  const [rows, total] = await Promise.all([Party.find(filter).sort({ name: 1 }).skip((p - 1) * PAGE).limit(PAGE).lean(), Party.countDocuments(filter)]);
  return paged(rows, total, p);
}

export async function getParty(ctx: Ctx, kind: "customer" | "supplier", id: string) {
  need(ctx, partyPerm(kind));
  const p = isId(id) ? await Party.findOne({ orgId: ctx.orgId, _id: id, kind }).lean() : null;
  if (!p) throw new AppError("NOT_FOUND", "Not found");
  const [docs, statement, stats] = await Promise.all([
    kind === "customer"
      ? Sale.find({ orgId: ctx.orgId, customerId: p._id, status: { $in: ["completed", "void"] } }, { number: 1, kind: 1, status: 1, grandTotal: 1, balanceDue: 1, completedAt: 1 }).sort({ completedAt: -1 }).limit(50).lean()
      : PurchaseOrder.find({ orgId: ctx.orgId, supplierId: p._id }, { number: 1, status: 1, supplierInvoiceNo: 1, receivedValue: 1, returnedValue: 1, amountPaid: 1, createdAt: 1, billDate: 1, attachments: 1 }).sort({ createdAt: -1 }).limit(50).lean(),
    partyStatement(ctx, String(p._id)),
    kind === "customer"
      ? Sale.aggregate<{ total: number; count: number }>([{ $match: { orgId: p.orgId, customerId: p._id, status: "completed", kind: { $ne: "return" } } }, { $group: { _id: null, total: { $sum: "$grandTotal" }, count: { $sum: 1 } } }])
      : PurchaseOrder.aggregate<{ total: number; count: number; paid?: number }>([{ $match: { orgId: p.orgId, supplierId: p._id } }, { $group: { _id: null, total: { $sum: { $subtract: ["$receivedValue", "$returnedValue"] } }, paid: { $sum: "$amountPaid" }, count: { $sum: 1 } } }]),
  ]);
  return { party: p, documents: docs, statement, stats: stats[0] ?? { total: 0, count: 0 } };
}

export async function khata(ctx: Ctx, q: Query) {
  need(ctx, "parties:read");
  const canSuppliers = can(ctx.role, "purchases:read");
  const kind = q.tab === "suppliers" && canSuppliers ? "supplier" : "customer";
  const p = page(q);
  const filter: Record<string, unknown> = { orgId: ctx.orgId, kind, active: true };
  const s = text(q.q, 60);
  if (s) filter.$or = [{ name: rx(s) }, { phone: rx(s) }];
  const sum = async (k: string) =>
    (await Party.aggregate<{ t: number }>([{ $match: { orgId: new Types.ObjectId(ctx.orgId), kind: k, active: true, balance: { $gt: 0 } } }, { $group: { _id: null, t: { $sum: "$balance" } } }]))[0]?.t ?? 0;
  const [rows, total, youGet, youGive] = await Promise.all([
    Party.find(filter, { name: 1, phone: 1, balance: 1, kind: 1 }).sort({ balance: -1, name: 1 }).skip((p - 1) * PAGE).limit(PAGE).lean(),
    Party.countDocuments(filter),
    sum("customer"),
    canSuppliers ? sum("supplier") : Promise.resolve(0),
  ]);
  return { ...paged(rows, total, p), kind, youGet, youGive };
}

/* ---------------- purchases ---------------- */

export async function listPurchases(ctx: Ctx, q: Query) {
  need(ctx, "purchases:read");
  const p = page(q);
  const filter: Record<string, unknown> = { orgId: ctx.orgId };
  const s = text(q.q, 60);
  if (s) filter.$or = [{ number: rx(s) }, { supplierName: rx(s) }, { supplierInvoiceNo: rx(s) }];
  if (q.status && ["ordered", "partial", "received", "cancelled"].includes(q.status)) filter.status = q.status;
  const [rows, total] = await Promise.all([PurchaseOrder.find(filter, { receipts: 0 }).sort({ createdAt: -1 }).skip((p - 1) * PAGE).limit(PAGE).lean(), PurchaseOrder.countDocuments(filter)]);
  return paged(rows, total, p);
}

export async function getPurchase(ctx: Ctx, id: string) {
  need(ctx, "purchases:read");
  const po = isId(id) ? await PurchaseOrder.findOne({ orgId: ctx.orgId, _id: id }).lean() : null;
  if (!po) throw new AppError("NOT_FOUND", "Not found");
  const [location, products] = await Promise.all([
    Location.findOne({ orgId: ctx.orgId, _id: po.locationId }, { name: 1 }).lean(),
    Product.find({ orgId: ctx.orgId, _id: { $in: po.lines.map((l) => l.productId) } }, { name: 1, trackBatch: 1, trackSerial: 1, unit: 1, "variants._id": 1, "variants.name": 1, "variants.sku": 1 }).lean(),
  ]);
  return { purchase: po, location, products };
}

/* ---------------- settings, team, audit ---------------- */

export async function settings(ctx: Ctx) {
  need(ctx, "settings:manage");
  const s = await getOrgSettings(ctx.orgId);
  return { ...s, einvoice: await getEinvoiceSettings(ctx) };
}

export async function members(ctx: Ctx) {
  need(ctx, "members:manage");
  const h = await headers();
  const [list, invitations] = await Promise.all([
    auth.api.listMembers({ headers: h, query: { organizationId: ctx.orgId } }),
    auth.api.listInvitations({ headers: h, query: { organizationId: ctx.orgId } }),
  ]);
  return { members: list.members, invitations };
}

export async function auditLog(ctx: Ctx, q: Query) {
  need(ctx, "audit:read");
  const p = page(q);
  const filter: Record<string, unknown> = { orgId: ctx.orgId };
  if (q.entity && /^[a-z_]{2,30}$/.test(q.entity)) filter.entity = q.entity;
  const s = text(q.q, 60);
  if (s) filter.$or = [{ summary: rx(s) }, { userName: rx(s) }];
  const [rows, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip((p - 1) * PAGE).limit(PAGE).lean(), AuditLog.countDocuments(filter)]);
  return paged(rows, total, p);
}
