# Galla REST API v1

One API for every Galla app: Windows, macOS, iPhone/iPad (Android later) and the browser. Every write runs the
same validated, permission-checked code as the web screens, so stock, GST, khata, serials and offline
sync behave identically everywhere. The live list is always at `GET /api/v1`.

## Basics

- **Base URL:** `https://<your-galla-server>/api/v1`
- **Format:** JSON in, JSON out. Money is in **paise** (integer, ₹1 = 100). Quantities are integers (kg/litre products use the unit scale, e.g. 1.250 kg = 1250).
- **Envelope:** success `{ "ok": true, "data": ... }`; failure `{ "ok": false, "code": "...", "error": "human message", "fieldErrors": { "field": ["..."] } }`.
- **Status codes:** 200 ok · 400 bad request · 401 `UNAUTHENTICATED` · 403 `FORBIDDEN` · 404 `NOT_FOUND` · 409 `CONFLICT` / `INSUFFICIENT_STOCK` / `CREDIT_LIMIT` · 413 too large · 415 not JSON · 422 `INVALID` (see `fieldErrors`) · 429 too many attempts · 500 `INTERNAL`.
- **Lists** take `?page=` and return `{ items, total, page, pageSize, pages }`.

## Signing in (native apps)

```http
POST /api/v1/auth/sign-in
Content-Type: application/json

{ "email": "owner@shop.in", "password": "..." }
```
→ `{ "ok": true, "data": { "twoFactor": false, "token": "<session token>" } }`

Send the token on every request: `Authorization: Bearer <token>`. If `twoFactor` is `true`, call
`POST /auth/two-factor/verify` with `{ "code", "backup": false, "trustDevice": true }`; it returns the token.
Unverified emails get `403` with `error: "UNVERIFIED"`. Sessions last 7 days and renew daily while used.
Browser and embedded (Electron) clients can use the session cookie instead; cookie-authenticated
writes must come from the Galla origin (CSRF protection).

The active business decides what every call sees. Switch with `POST /businesses/:id/switch`.
Roles (owner, manager, cashier, stock keeper) apply exactly as on the web; cost prices are returned as `0`
to roles that can't see them.

## Other endpoints that are already REST

- `POST /api/uploads` (multipart `file`, `kind=image|doc`) → `{ url }` for product images, logos and supplier bills.
- `POST /api/scan/:token` `{ code }` — a paired phone pushes a scanned barcode; `GET /api/scan/:token/stream` is the desktop's live feed.
- `GET /api/export/:report?from&to&format=xlsx|csv` — Excel/CSV reports.
- `GET /api/health` — health check.

## App versions and keeping clients in step

- Apps send `X-Galla-Client: android/<version>` (or `ios/…`, `desktop/…`). If the server's `MIN_ANDROID_VERSION` (etc.) is newer, every call answers
  **426** `UPGRADE_REQUIRED` with `minVersion`, and the app shows an update screen. Browsers send nothing and are never blocked.
- `GET /api/v1` returns `minClientVersions` and the full route list with each route's `name`.
- The route list lives in `src/lib/api/routes.ts`, shared by the server and the apps. The Android app imports it to build URLs and
  type-checks every call against the server's `ApiTypes` (`src/server/api/routes.ts`), so a changed endpoint fails the app's build in CI
  instead of failing in a shop. Path parameters are named after the input field they fill (`/sales/:saleId/refund`).
- Changes must stay backward compatible for apps already installed: add optional fields, don't rename or remove. When a breaking change
  is unavoidable, ship the app update first, then raise `MIN_ANDROID_VERSION`.

## Endpoints

Generated from `src/lib/api/routes.ts` by `npm run api:docs`. The name column is what the apps call (`api.call("sales.refund", …)`).

### Auth & account (Better Auth's own endpoints live under /api/auth/*)

| Method | Path | Name | What it does |
|---|---|---|---|
| `POST` | `/api/v1/auth/sign-in` | `auth.signIn` | Sign in with email + password. Returns { token } for native apps (send as Authorization: Bearer). _(no sign-in)_ |
| `POST` | `/api/v1/auth/sign-up` | `auth.signUp` | Create an account; a verification email is sent. _(no sign-in)_ |
| `POST` | `/api/v1/auth/verification-email` | `auth.resendVerification` | Resend the verification email. _(no sign-in)_ |
| `POST` | `/api/v1/auth/password-reset` | `auth.requestPasswordReset` | Email a password reset link. _(no sign-in)_ |
| `POST` | `/api/v1/auth/password-reset/confirm` | `auth.resetPassword` | Set a new password with the emailed token. _(no sign-in)_ |
| `POST` | `/api/v1/auth/two-factor/verify` | `auth.verifyTwoFactor` | Finish a sign-in that needs a 2FA code. _(no sign-in)_ |
| `POST` | `/api/v1/auth/sign-out` | `auth.signOut` | End this session (the bearer token stops working). |
| `PUT` | `/api/v1/account/name` | `account.updateName` | Change your display name ({ name }). |
| `POST` | `/api/v1/account/password` | `account.changePassword` | Change password. |
| `POST` | `/api/v1/account/two-factor/enable` | `account.enableTwoFactor` | Start 2FA setup (returns the TOTP URI and backup codes). |
| `POST` | `/api/v1/account/two-factor/confirm` | `account.confirmTwoFactor` | Confirm 2FA with a code. |
| `POST` | `/api/v1/account/two-factor/disable` | `account.disableTwoFactor` | Turn 2FA off. |
| `GET` | `/api/v1/account/deletion` | `account.deletionPreview` | What deleting this account would remove, and what blocks it. |
| `POST` | `/api/v1/account/delete` | `account.delete` | Permanently delete this account ({ password, confirm: "DELETE" }). |
| `POST` | `/api/v1/invitations/:invitationId/accept` | `invitations.accept` | Accept a team invitation. |
| `GET` | `/api/v1/me` | `me` | Signed-in user, active business (currency, locale, role, settings) and all their businesses. |

### Businesses

| Method | Path | Name | What it does |
|---|---|---|---|
| `POST` | `/api/v1/businesses` | `businesses.create` | Create a business (onboarding). |
| `POST` | `/api/v1/businesses/:organizationId/switch` | `businesses.switch` | Make another business active. |

### Dashboard & reports

| Method | Path | Name | What it does |
|---|---|---|---|
| `GET` | `/api/v1/dashboard` | `dashboard` | Today vs yesterday, 30-day sales, top products, low stock, expiring batches, dues, recent bills. |
| `GET` | `/api/v1/reports` | `reports` | All reports for ?from=YYYY-MM-DD&to=YYYY-MM-DD (sales, payments, cashiers, categories, GST/HSN, stock, expiry, dues). |

### Products

| Method | Path | Name | What it does |
|---|---|---|---|
| `GET` | `/api/v1/products` | `products.list` | List products (?q, ?category, ?status=archived, ?page). |
| `GET` | `/api/v1/products/form-data` | `products.formData` | Categories, tax rates, locations and defaults for the product form. |
| `GET` | `/api/v1/products/search` | `products.search` | POS search (?q, ?locationId). |
| `GET` | `/api/v1/products/lookup` | `products.lookup` | Find by barcode/SKU/serial (?code, ?locationId). |
| `GET` | `/api/v1/products/:id` | `products.get` | Product with stock by location and recent movements. |
| `POST` | `/api/v1/products` | `products.create` | Create a product. |
| `PUT` | `/api/v1/products/:id` | `products.update` | Update a product. |
| `PUT` | `/api/v1/products/:id/active` | `products.setActive` | Archive or restore ({ active }). |
| `GET` | `/api/v1/variants/:variantId/serials` | `variants.serials` | Serials in stock (?locationId). |
| `GET` | `/api/v1/variants/:variantId/batches` | `variants.batches` | Batches with stock (?locationId). |
| `GET` | `/api/v1/categories` | `categories.list` | List categories. |
| `POST` | `/api/v1/categories` | `categories.create` | Create a category. |
| `PUT` | `/api/v1/categories/:id` | `categories.update` | Rename/move a category. |
| `DELETE` | `/api/v1/categories/:id` | `categories.delete` | Delete an empty category. |
| `GET` | `/api/v1/tax-rates` | `taxRates.list` | List tax rates. |
| `POST` | `/api/v1/tax-rates` | `taxRates.create` | Create a tax rate. |
| `PUT` | `/api/v1/tax-rates/:id` | `taxRates.update` | Update a tax rate. |
| `DELETE` | `/api/v1/tax-rates/:id` | `taxRates.delete` | Delete a tax rate. |
| `GET` | `/api/v1/locations` | `locations.list` | Shops and warehouses. |
| `POST` | `/api/v1/locations` | `locations.create` | Add a location. |
| `PUT` | `/api/v1/locations/:id` | `locations.update` | Update a location. |

### Inventory

| Method | Path | Name | What it does |
|---|---|---|---|
| `GET` | `/api/v1/stock` | `stock.list` | Stock by product and location (?q, ?location, ?filter=low, ?page). |
| `GET` | `/api/v1/stock/moves` | `stock.moves` | Movement history (?from, ?to, ?type, ?product, ?page). |
| `GET` | `/api/v1/serials` | `serials.list` | Serial / IMEI register (?q, ?status, ?page). |
| `POST` | `/api/v1/stock/adjustments` | `stock.adjust` | Adjust stock with a reason. |
| `POST` | `/api/v1/stock/transfers` | `stock.transfer` | Transfer stock between locations. |
| `POST` | `/api/v1/stock/counts` | `stock.count` | Post a stock count. |

### Point of sale & sales

| Method | Path | Name | What it does |
|---|---|---|---|
| `POST` | `/api/v1/sales` | `sales.checkout` | Complete a sale (checkout). |
| `GET` | `/api/v1/sales` | `sales.list` | Bills (?from, ?to, ?q, ?type=return\|credit\|void\|invoice\|review, ?page). |
| `GET` | `/api/v1/sales/:saleId` | `sales.get` | Full bill: lines, taxes, payments, customer, e-invoice. |
| `GET` | `/api/v1/sales/:saleId/detail` | `sales.detail` | Bill screen: the bill plus returned quantities, credit notes, sync issues and what this role may do. |
| `POST` | `/api/v1/sales/:saleId/refund` | `sales.refund` | Return items (credit note). |
| `POST` | `/api/v1/sales/:saleId/void` | `sales.void` | Void a same-day sale ({ reason }). |
| `POST` | `/api/v1/sales/:saleId/share-link` | `sales.shareLink` | Secure link for WhatsApp bills. |
| `POST` | `/api/v1/sales/:saleId/reviewed` | `sales.markReviewed` | Mark an offline-sync issue as reviewed. |
| `POST` | `/api/v1/sales/:saleId/einvoice` | `sales.einvoice` | Generate IRN + signed QR. |
| `POST` | `/api/v1/sales/:saleId/einvoice/cancel` | `sales.einvoiceCancel` | Cancel the IRN ({ reason, remark }). |
| `POST` | `/api/v1/sales/:saleId/eway-bill` | `sales.ewayBill` | Generate an e-way bill ({ details }). |
| `POST` | `/api/v1/sales/:saleId/gst-json` | `sales.gstJson` | GST JSON for manual upload ({ type, details? }). |
| `GET` | `/api/v1/held-bills` | `heldBills.list` | Parked bills (?locationId). |
| `POST` | `/api/v1/held-bills` | `heldBills.hold` | Park a bill (F8). |
| `POST` | `/api/v1/held-bills/:id/resume` | `heldBills.resume` | Bring a parked bill back (F9). |
| `DELETE` | `/api/v1/held-bills/:id` | `heldBills.discard` | Discard a parked bill. |
| `GET` | `/api/v1/pos/batches` | `pos.batches` | Batches a cashier can sell from (?variantId, ?locationId). |
| `GET` | `/api/v1/pos/customers` | `pos.customers` | Customer picker search (?q). |
| `POST` | `/api/v1/pos/customers` | `pos.addCustomer` | Quick-add a customer at the till. |
| `GET` | `/api/v1/pos/snapshot` | `pos.snapshot` | Offline catalogue snapshot for a till (?locationId). |
| `POST` | `/api/v1/pos/tills` | `pos.registerTill` | Register this device as a till ({ name }). |
| `POST` | `/api/v1/pos/offline-sales` | `pos.syncOffline` | Sync bills made offline ({ deviceToken, sales }). |
| `POST` | `/api/v1/scan-sessions` | `scanSessions.start` | Pair a phone as a wireless scanner (returns a token; phones push to /api/scan/:token). |
| `DELETE` | `/api/v1/scan-sessions/:token` | `scanSessions.stop` | End a phone-scanner pairing. |

### Customers, suppliers, khata

| Method | Path | Name | What it does |
|---|---|---|---|
| `GET` | `/api/v1/customers` | `customers.list` | Customers (?q, ?due=1, ?page). |
| `GET` | `/api/v1/customers/:id` | `customers.get` | Customer with bills, running-balance statement and totals. |
| `POST` | `/api/v1/customers` | `customers.create` | Add a customer. |
| `PUT` | `/api/v1/customers/:id` | `customers.update` | Update a customer. |
| `GET` | `/api/v1/suppliers` | `suppliers.list` | Suppliers (?q, ?due=1, ?page). |
| `GET` | `/api/v1/suppliers/:id` | `suppliers.get` | Supplier with purchases, statement and totals. |
| `POST` | `/api/v1/suppliers` | `suppliers.create` | Add a supplier. |
| `PUT` | `/api/v1/suppliers/:id` | `suppliers.update` | Update a supplier. |
| `PUT` | `/api/v1/parties/:id/active` | `parties.setActive` | Archive or restore a customer/supplier ({ active }). |
| `GET` | `/api/v1/parties/:partyId/open-bills` | `parties.openBills` | Unpaid bills a payment can be set against. |
| `POST` | `/api/v1/parties/:partyId/payments` | `parties.addPayment` | Record a payment (optionally against chosen bills). |
| `POST` | `/api/v1/parties/:partyId/udhaar` | `parties.addUdhaar` | Khata: udhaar given/taken without a bill. |
| `POST` | `/api/v1/ledger/:entryId/reverse` | `ledger.reverse` | Undo a khata entry or payment ({ reason }); owners/managers. |
| `GET` | `/api/v1/khata` | `khata` | Khata balances (?tab=suppliers, ?q, ?page) with you'll get / you'll give totals. |

### Purchases

| Method | Path | Name | What it does |
|---|---|---|---|
| `GET` | `/api/v1/purchases` | `purchases.list` | Purchase orders and bills (?q, ?status, ?page). |
| `GET` | `/api/v1/purchases/:id` | `purchases.get` | Purchase with receipts, payments and attachments. |
| `POST` | `/api/v1/purchases` | `purchases.create` | Create a purchase order. |
| `PUT` | `/api/v1/purchases/:id` | `purchases.update` | Edit a purchase order. |
| `POST` | `/api/v1/purchases/:id/receive` | `purchases.receive` | Receive goods (partial allowed). |
| `POST` | `/api/v1/purchases/:id/return` | `purchases.return` | Return goods to the supplier. |
| `POST` | `/api/v1/purchases/:id/cancel` | `purchases.cancel` | Cancel a purchase order. |
| `POST` | `/api/v1/purchases/:id/attachments` | `purchases.attach` | Attach uploaded bill photos/PDFs ({ files }). |
| `DELETE` | `/api/v1/purchases/:id/attachments` | `purchases.detach` | Remove an attachment ({ url }). |
| `POST` | `/api/v1/purchase-bills` | `purchaseBills.create` | Record a supplier bill in one step (stock in + payment). |

### Settings, team, audit, import

| Method | Path | Name | What it does |
|---|---|---|---|
| `GET` | `/api/v1/settings` | `settings.get` | Business, receipt, scanner and e-invoice settings (owner). |
| `PUT` | `/api/v1/settings/business` | `settings.updateBusiness` | Update business details. |
| `PUT` | `/api/v1/settings/receipt` | `settings.updateReceipt` | Update receipt and scanner settings. |
| `PUT` | `/api/v1/settings/einvoice` | `settings.updateEinvoice` | Save GST e-invoice API settings. |
| `POST` | `/api/v1/settings/einvoice/test` | `settings.testEinvoice` | Test the e-invoice connection. |
| `GET` | `/api/v1/members` | `members.list` | Team members and pending invitations. |
| `POST` | `/api/v1/members/invitations` | `members.invite` | Invite by email ({ email, role }). |
| `DELETE` | `/api/v1/members/invitations/:invitationId` | `members.cancelInvitation` | Cancel an invitation. |
| `PUT` | `/api/v1/members/:memberId/role` | `members.updateRole` | Change a member's role ({ role }). |
| `DELETE` | `/api/v1/members/:memberId` | `members.remove` | Remove a member. |
| `GET` | `/api/v1/audit` | `audit` | Audit log (?entity, ?q, ?page). |
| `POST` | `/api/v1/imports/preview` | `imports.preview` | Preview an Excel/CSV import (multipart: kind, file). |
| `POST` | `/api/v1/imports` | `imports.run` | Run an Excel/CSV import (multipart: kind, file). |
