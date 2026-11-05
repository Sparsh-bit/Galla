import "server-only";
import * as authA from "../actions/auth";
import * as einvoice from "../actions/einvoice";
import * as imports from "../actions/imports";
import * as inventory from "../actions/inventory";
import * as offline from "../actions/offline";
import * as onboarding from "../actions/onboarding";
import * as parties from "../actions/parties";
import * as products from "../actions/products";
import * as purchases from "../actions/purchases";
import * as sales from "../actions/sales";
import * as settingsA from "../actions/settings";
import type { Ctx } from "../context";
import type { ActionResult } from "../with-auth";
import * as Q from "./queries";

// Galla REST API v1: one table for every platform (web, Windows, macOS, iOS, Android).
// Writes call the exact same validated, permission-checked actions the web app uses, so every
// business rule (stock, GST, khata, serials, offline sync) lives in one place.

export type Method = "GET" | "POST" | "PUT" | "DELETE";
export interface Req {
  params: Record<string, string>;
  query: Q.Query;
  body: Record<string, unknown>;
  form: FormData | null;
}
export type Route =
  | { method: Method; path: string; summary: string; kind: "action"; run: (r: Req) => Promise<ActionResult<unknown>>; public?: boolean }
  | { method: Method; path: string; summary: string; kind: "query"; run: (ctx: Ctx, r: Req) => Promise<unknown> };

type AnyAction = (input: never) => Promise<ActionResult<unknown>>;
const call = (fn: AnyAction, input: unknown) => fn(input as never);

/** A write backed by an existing action; `map` builds the action input from the request. */
const act = (method: Method, path: string, summary: string, fn: AnyAction, map: (r: Req) => unknown = (r) => r.body, isPublic = false): Route => ({
  method, path, summary, kind: "action", run: (r) => call(fn, map(r)), public: isPublic,
});
/** A read; errors and permissions are handled by the dispatcher and the query itself. */
const get = (path: string, summary: string, run: (ctx: Ctx, r: Req) => Promise<unknown>): Route => ({ method: "GET", path, summary, kind: "query", run });

const withId = (key: string) => (r: Req) => ({ ...r.body, [key]: r.params.id });
const qs = (r: Req, ...keys: string[]) => Object.fromEntries(keys.filter((k) => r.query[k] !== undefined).map((k) => [k, r.query[k]]));
const form = (r: Req) => r.form ?? new FormData();

export const ROUTES: Route[] = [
  /* ---------- auth & account (Better Auth's own endpoints live under /api/auth/*) ---------- */
  act("POST", "/auth/sign-in", "Sign in with email + password. Returns { token } for native apps (send as Authorization: Bearer).", authA.signInAction, (r) => r.body, true),
  act("POST", "/auth/sign-up", "Create an account; a verification email is sent.", authA.signUpAction, (r) => ({ next: "/onboarding", ...r.body }), true),
  act("POST", "/auth/verification-email", "Resend the verification email.", authA.resendVerificationAction, (r) => r.body, true),
  act("POST", "/auth/password-reset", "Email a password reset link.", authA.requestResetAction, (r) => r.body, true),
  act("POST", "/auth/password-reset/confirm", "Set a new password with the emailed token.", authA.resetPasswordAction, (r) => r.body, true),
  act("POST", "/auth/two-factor/verify", "Finish a sign-in that needs a 2FA code.", authA.verifyTwoFactorAction, (r) => r.body, true),
  act("POST", "/account/password", "Change password.", authA.changePasswordAction),
  act("POST", "/account/two-factor/enable", "Start 2FA setup (returns the TOTP URI and backup codes).", authA.enableTwoFactorAction),
  act("POST", "/account/two-factor/confirm", "Confirm 2FA with a code.", authA.confirmTwoFactorAction),
  act("POST", "/account/two-factor/disable", "Turn 2FA off.", authA.disableTwoFactorAction),
  act("POST", "/invitations/:id/accept", "Accept a team invitation.", authA.acceptInviteAction, (r) => ({ invitationId: r.params.id })),
  get("/me", "Signed-in user, active business (currency, locale, role) and all their businesses.", (ctx) => Q.me(ctx)),

  /* ---------- businesses ---------- */
  act("POST", "/businesses", "Create a business (onboarding).", onboarding.createBusiness),
  act("POST", "/businesses/:id/switch", "Make another business active.", onboarding.switchBusiness as AnyAction, (r) => r.params.id),

  /* ---------- dashboard & reports ---------- */
  get("/dashboard", "Today vs yesterday, 30-day sales, top products, low stock, expiring batches, dues, recent bills.", (ctx) => Q.dashboard(ctx)),
  get("/reports", "All reports for ?from=YYYY-MM-DD&to=YYYY-MM-DD (sales, payments, cashiers, categories, GST/HSN, stock, expiry, dues).", (ctx, r) => Q.reports(ctx, r.query)),

  /* ---------- products ---------- */
  get("/products", "List products (?q, ?category, ?status=archived, ?page).", (ctx, r) => Q.listProducts(ctx, r.query)),
  get("/products/form-data", "Categories, tax rates, locations and defaults for the product form.", (ctx) => Q.productFormData(ctx)),
  act("GET", "/products/search", "POS search (?q, ?locationId).", products.searchProducts, (r) => ({ q: r.query.q ?? "", ...qs(r, "locationId") })),
  act("GET", "/products/lookup", "Find by barcode/SKU/serial (?code, ?locationId).", products.lookupCode, (r) => ({ code: r.query.code ?? "", ...qs(r, "locationId") })),
  get("/products/:id", "Product with stock by location and recent movements.", (ctx, r) => Q.getProduct(ctx, r.params.id)),
  act("POST", "/products", "Create a product.", products.saveProduct, (r) => ({ id: null, data: r.body })),
  act("PUT", "/products/:id", "Update a product.", products.saveProduct, (r) => ({ id: r.params.id, data: r.body })),
  act("PUT", "/products/:id/active", "Archive or restore ({ active }).", products.archiveProduct, withId("id")),
  act("GET", "/variants/:id/serials", "Serials in stock (?locationId).", products.availableSerials, (r) => ({ variantId: r.params.id, locationId: r.query.locationId })),
  act("GET", "/variants/:id/batches", "Batches with stock (?locationId).", inventory.variantBatches, (r) => ({ variantId: r.params.id, locationId: r.query.locationId })),

  get("/categories", "List categories.", (ctx) => Q.listCategories(ctx)),
  act("POST", "/categories", "Create a category.", products.saveCategory, (r) => ({ id: null, parentId: null, ...r.body })),
  act("PUT", "/categories/:id", "Rename/move a category.", products.saveCategory, (r) => ({ parentId: null, ...r.body, id: r.params.id })),
  act("DELETE", "/categories/:id", "Delete an empty category.", products.deleteCategory, (r) => ({ id: r.params.id })),

  act("GET", "/tax-rates", "List tax rates.", products.listTaxRates, () => ({})),
  act("POST", "/tax-rates", "Create a tax rate.", settingsA.saveTaxRate, (r) => ({ id: null, ...r.body })),
  act("PUT", "/tax-rates/:id", "Update a tax rate.", settingsA.saveTaxRate, withId("id")),
  act("DELETE", "/tax-rates/:id", "Delete a tax rate.", settingsA.deleteTaxRate, (r) => ({ id: r.params.id })),

  get("/locations", "Shops and warehouses.", (ctx) => Q.listLocations(ctx)),
  act("POST", "/locations", "Add a location.", inventory.saveLocation, (r) => ({ id: null, ...r.body })),
  act("PUT", "/locations/:id", "Update a location.", inventory.saveLocation, withId("id")),

  /* ---------- inventory ---------- */
  get("/stock", "Stock by product and location (?q, ?location, ?filter=low, ?page).", (ctx, r) => Q.listStock(ctx, r.query)),
  get("/stock/moves", "Movement history (?from, ?to, ?type, ?product, ?page).", (ctx, r) => Q.listMoves(ctx, r.query)),
  get("/serials", "Serial / IMEI register (?q, ?status, ?page).", (ctx, r) => Q.listSerials(ctx, r.query)),
  act("POST", "/stock/adjustments", "Adjust stock with a reason.", inventory.adjust),
  act("POST", "/stock/transfers", "Transfer stock between locations.", inventory.transfer),
  act("POST", "/stock/counts", "Post a stock count.", inventory.count),

  /* ---------- point of sale & sales ---------- */
  act("POST", "/sales", "Complete a sale (checkout).", sales.checkout),
  get("/sales", "Bills (?from, ?to, ?q, ?type=return|credit|void|invoice|review, ?page).", (ctx, r) => Q.listSales(ctx, r.query)),
  act("GET", "/sales/:id", "Full bill: lines, taxes, payments, customer, e-invoice.", sales.receiptData, (r) => ({ saleId: r.params.id })),
  act("POST", "/sales/:id/refund", "Return items (credit note).", sales.refundSale, withId("saleId")),
  act("POST", "/sales/:id/void", "Void a same-day sale ({ reason }).", sales.cancelSale, withId("saleId")),
  act("POST", "/sales/:id/share-link", "Secure link for WhatsApp bills.", sales.billShareLink, (r) => ({ saleId: r.params.id })),
  act("POST", "/sales/:id/reviewed", "Mark an offline-sync issue as reviewed.", offline.markSaleReviewed, (r) => ({ saleId: r.params.id })),
  act("POST", "/sales/:id/einvoice", "Generate IRN + signed QR.", einvoice.createIrn, (r) => ({ saleId: r.params.id })),
  act("POST", "/sales/:id/einvoice/cancel", "Cancel the IRN ({ reason, remark }).", einvoice.voidIrn, withId("saleId")),
  act("POST", "/sales/:id/eway-bill", "Generate an e-way bill ({ details }).", einvoice.createEwb, withId("saleId")),
  act("POST", "/sales/:id/gst-json", "GST JSON for manual upload ({ type, details? }).", einvoice.downloadGstJson, withId("saleId")),

  act("GET", "/held-bills", "Parked bills (?locationId).", sales.listHeldBills, (r) => ({ locationId: r.query.locationId })),
  act("POST", "/held-bills", "Park a bill (F8).", sales.holdBill),
  act("POST", "/held-bills/:id/resume", "Bring a parked bill back (F9).", sales.resumeHeldBill, (r) => ({ id: r.params.id })),
  act("DELETE", "/held-bills/:id", "Discard a parked bill.", sales.discardHeldBill, (r) => ({ id: r.params.id })),
  act("GET", "/pos/batches", "Batches a cashier can sell from (?variantId, ?locationId).", sales.listBatches, (r) => ({ variantId: r.query.variantId, locationId: r.query.locationId })),
  act("GET", "/pos/customers", "Customer picker search (?q).", sales.findCustomers, (r) => ({ q: r.query.q ?? "" })),
  act("POST", "/pos/customers", "Quick-add a customer at the till.", sales.quickAddCustomer),
  act("GET", "/pos/snapshot", "Offline catalogue snapshot for a till (?locationId).", offline.getPosSnapshot, (r) => ({ locationId: r.query.locationId })),
  act("POST", "/pos/tills", "Register this device as a till ({ name }).", offline.registerTill),
  act("POST", "/pos/offline-sales", "Sync bills made offline ({ deviceToken, sales }).", offline.syncOfflineSales),
  act("POST", "/scan-sessions", "Pair a phone as a wireless scanner (returns a token; phones push to /api/scan/:token).", sales.startRemoteScan, () => ({})),
  act("DELETE", "/scan-sessions/:id", "End a phone-scanner pairing.", sales.stopRemoteScan, (r) => ({ token: r.params.id })),

  /* ---------- customers, suppliers, khata ---------- */
  get("/customers", "Customers (?q, ?due=1, ?page).", (ctx, r) => Q.listParties(ctx, "customer", r.query)),
  get("/customers/:id", "Customer with bills, running-balance statement and totals.", (ctx, r) => Q.getParty(ctx, "customer", r.params.id)),
  act("POST", "/customers", "Add a customer.", parties.upsertParty, (r) => ({ id: null, data: { ...r.body, kind: "customer" } })),
  act("PUT", "/customers/:id", "Update a customer.", parties.upsertParty, (r) => ({ id: r.params.id, data: { ...r.body, kind: "customer" } })),
  get("/suppliers", "Suppliers (?q, ?due=1, ?page).", (ctx, r) => Q.listParties(ctx, "supplier", r.query)),
  get("/suppliers/:id", "Supplier with purchases, statement and totals.", (ctx, r) => Q.getParty(ctx, "supplier", r.params.id)),
  act("POST", "/suppliers", "Add a supplier.", parties.upsertParty, (r) => ({ id: null, data: { ...r.body, kind: "supplier" } })),
  act("PUT", "/suppliers/:id", "Update a supplier.", parties.upsertParty, (r) => ({ id: r.params.id, data: { ...r.body, kind: "supplier" } })),
  act("PUT", "/parties/:id/active", "Archive or restore a customer/supplier ({ active }).", parties.archiveParty, withId("id")),
  act("GET", "/parties/:id/open-bills", "Unpaid bills a payment can be set against.", parties.openBills, (r) => ({ partyId: r.params.id })),
  act("POST", "/parties/:id/payments", "Record a payment (optionally against chosen bills).", parties.addPayment, withId("partyId")),
  act("POST", "/parties/:id/udhaar", "Khata: udhaar given/taken without a bill.", parties.addUdhaarEntry, withId("partyId")),
  act("POST", "/ledger/:id/reverse", "Undo a khata entry or payment ({ reason }); owners/managers.", parties.undoEntry, withId("entryId")),
  get("/khata", "Khata balances (?tab=suppliers, ?q, ?page) with you'll get / you'll give totals.", (ctx, r) => Q.khata(ctx, r.query)),

  /* ---------- purchases ---------- */
  get("/purchases", "Purchase orders and bills (?q, ?status, ?page).", (ctx, r) => Q.listPurchases(ctx, r.query)),
  get("/purchases/:id", "Purchase with receipts, payments and attachments.", (ctx, r) => Q.getPurchase(ctx, r.params.id)),
  act("POST", "/purchases", "Create a purchase order.", purchases.savePO, (r) => ({ id: null, data: r.body })),
  act("PUT", "/purchases/:id", "Edit a purchase order.", purchases.savePO, (r) => ({ id: r.params.id, data: r.body })),
  act("POST", "/purchases/:id/receive", "Receive goods (partial allowed).", purchases.receivePO, withId("id")),
  act("POST", "/purchases/:id/return", "Return goods to the supplier.", purchases.returnPO, withId("id")),
  act("POST", "/purchases/:id/cancel", "Cancel a purchase order.", purchases.cancelPO, (r) => ({ id: r.params.id })),
  act("POST", "/purchases/:id/attachments", "Attach uploaded bill photos/PDFs ({ files }).", purchases.attachFiles, withId("id")),
  act("DELETE", "/purchases/:id/attachments", "Remove an attachment ({ url }).", purchases.detachFile, withId("id")),
  act("POST", "/purchase-bills", "Record a supplier bill in one step (stock in + payment).", purchases.savePurchaseBill),

  /* ---------- settings, team, audit, import ---------- */
  get("/settings", "Business, receipt, scanner and e-invoice settings (owner).", (ctx) => Q.settings(ctx)),
  act("PUT", "/settings/business", "Update business details.", settingsA.updateBusiness),
  act("PUT", "/settings/receipt", "Update receipt and scanner settings.", settingsA.updateReceipt),
  act("PUT", "/settings/einvoice", "Save GST e-invoice API settings.", einvoice.saveEinvoice),
  act("POST", "/settings/einvoice/test", "Test the e-invoice connection.", einvoice.testEinvoice, () => ({})),
  get("/members", "Team members and pending invitations.", (ctx) => Q.members(ctx)),
  act("POST", "/members/invitations", "Invite by email ({ email, role }).", authA.inviteMemberAction),
  act("DELETE", "/members/invitations/:id", "Cancel an invitation.", authA.cancelInvitationAction, (r) => ({ invitationId: r.params.id })),
  act("PUT", "/members/:id/role", "Change a member's role ({ role }).", authA.updateMemberRoleAction, withId("memberId")),
  act("DELETE", "/members/:id", "Remove a member.", authA.removeMemberAction, (r) => ({ memberId: r.params.id })),
  get("/audit", "Audit log (?entity, ?q, ?page).", (ctx, r) => Q.auditLog(ctx, r.query)),
  act("POST", "/imports/preview", "Preview an Excel/CSV import (multipart: kind, file).", imports.previewImport as AnyAction, form),
  act("POST", "/imports", "Run an Excel/CSV import (multipart: kind, file).", imports.runImport as AnyAction, form),
];

/** Matches "/sales/:id/refund" against a request path. */
export function match(method: string, path: string): { route: Route; params: Record<string, string> } | null {
  const parts = path.split("/").filter(Boolean);
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const pattern = route.path.split("/").filter(Boolean);
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (pattern.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i]))) return { route, params };
  }
  return null;
}
