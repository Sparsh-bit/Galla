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
Browser and embedded (Electron/Capacitor) clients can use the session cookie instead; cookie-authenticated
writes must come from the Galla origin (CSRF protection).

The active business decides what every call sees. Switch with `POST /businesses/:id/switch`.
Roles (owner, manager, cashier, stock keeper) apply exactly as on the web; cost prices are returned as `0`
to roles that can't see them.

## Other endpoints that are already REST

- `POST /api/uploads` (multipart `file`, `kind=image|doc`) → `{ url }` for product images, logos and supplier bills.
- `POST /api/scan/:token` `{ code }` — a paired phone pushes a scanned barcode; `GET /api/scan/:token/stream` is the desktop's live feed.
- `GET /api/export/:report?from&to&format=xlsx|csv` — Excel/CSV reports.
- `GET /api/health` — health check.

## Endpoints


### Auth & account (Better Auth's own endpoints live under /api/auth/*)

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/auth/sign-in` | Sign in with email + password. Returns { token } for native apps (send as Authorization: Bearer). |
| `POST` | `/api/v1/auth/sign-up` | Create an account; a verification email is sent. |
| `POST` | `/api/v1/auth/verification-email` | Resend the verification email. |
| `POST` | `/api/v1/auth/password-reset` | Email a password reset link. |
| `POST` | `/api/v1/auth/password-reset/confirm` | Set a new password with the emailed token. |
| `POST` | `/api/v1/auth/two-factor/verify` | Finish a sign-in that needs a 2FA code. |
| `POST` | `/api/v1/account/password` | Change password. |
| `POST` | `/api/v1/account/two-factor/enable` | Start 2FA setup (returns the TOTP URI and backup codes). |
| `POST` | `/api/v1/account/two-factor/confirm` | Confirm 2FA with a code. |
| `POST` | `/api/v1/account/two-factor/disable` | Turn 2FA off. |
| `POST` | `/api/v1/invitations/:id/accept` | Accept a team invitation. |
| `GET` | `/api/v1/me` | Signed-in user, active business (currency, locale, role) and all their businesses. |

### Businesses

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/businesses` | Create a business (onboarding). |
| `POST` | `/api/v1/businesses/:id/switch` | Make another business active. |

### Dashboard & reports

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/dashboard` | Today vs yesterday, 30-day sales, top products, low stock, expiring batches, dues, recent bills. |
| `GET` | `/api/v1/reports` | All reports for ?from=YYYY-MM-DD&to=YYYY-MM-DD (sales, payments, cashiers, categories, GST/HSN, stock, expiry, dues). |

### Products

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/products` | List products (?q, ?category, ?status=archived, ?page). |
| `GET` | `/api/v1/products/form-data` | Categories, tax rates, locations and defaults for the product form. |
| `GET` | `/api/v1/products/search` | POS search (?q, ?locationId). |
| `GET` | `/api/v1/products/lookup` | Find by barcode/SKU/serial (?code, ?locationId). |
| `GET` | `/api/v1/products/:id` | Product with stock by location and recent movements. |
| `POST` | `/api/v1/products` | Create a product. |
| `PUT` | `/api/v1/products/:id` | Update a product. |
| `PUT` | `/api/v1/products/:id/active` | Archive or restore ({ active }). |
| `GET` | `/api/v1/variants/:id/serials` | Serials in stock (?locationId). |
| `GET` | `/api/v1/variants/:id/batches` | Batches with stock (?locationId). |
| `GET` | `/api/v1/categories` | List categories. |
| `POST` | `/api/v1/categories` | Create a category. |
| `PUT` | `/api/v1/categories/:id` | Rename/move a category. |
| `DELETE` | `/api/v1/categories/:id` | Delete an empty category. |
| `GET` | `/api/v1/tax-rates` | List tax rates. |
| `POST` | `/api/v1/tax-rates` | Create a tax rate. |
| `PUT` | `/api/v1/tax-rates/:id` | Update a tax rate. |
| `DELETE` | `/api/v1/tax-rates/:id` | Delete a tax rate. |
| `GET` | `/api/v1/locations` | Shops and warehouses. |
| `POST` | `/api/v1/locations` | Add a location. |
| `PUT` | `/api/v1/locations/:id` | Update a location. |

### Inventory

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/stock` | Stock by product and location (?q, ?location, ?filter=low, ?page). |
| `GET` | `/api/v1/stock/moves` | Movement history (?from, ?to, ?type, ?product, ?page). |
| `GET` | `/api/v1/serials` | Serial / IMEI register (?q, ?status, ?page). |
| `POST` | `/api/v1/stock/adjustments` | Adjust stock with a reason. |
| `POST` | `/api/v1/stock/transfers` | Transfer stock between locations. |
| `POST` | `/api/v1/stock/counts` | Post a stock count. |

### Point of sale & sales

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/v1/sales` | Complete a sale (checkout). |
| `GET` | `/api/v1/sales` | Bills (?from, ?to, ?q, ?type=return\|credit\|void\|invoice\|review, ?page). |
| `GET` | `/api/v1/sales/:id` | Full bill: lines, taxes, payments, customer, e-invoice. |
| `POST` | `/api/v1/sales/:id/refund` | Return items (credit note). |
| `POST` | `/api/v1/sales/:id/void` | Void a same-day sale ({ reason }). |
| `POST` | `/api/v1/sales/:id/share-link` | Secure link for WhatsApp bills. |
| `POST` | `/api/v1/sales/:id/reviewed` | Mark an offline-sync issue as reviewed. |
| `POST` | `/api/v1/sales/:id/einvoice` | Generate IRN + signed QR. |
| `POST` | `/api/v1/sales/:id/einvoice/cancel` | Cancel the IRN ({ reason, remark }). |
| `POST` | `/api/v1/sales/:id/eway-bill` | Generate an e-way bill ({ details }). |
| `POST` | `/api/v1/sales/:id/gst-json` | GST JSON for manual upload ({ type, details? }). |
| `GET` | `/api/v1/held-bills` | Parked bills (?locationId). |
| `POST` | `/api/v1/held-bills` | Park a bill (F8). |
| `POST` | `/api/v1/held-bills/:id/resume` | Bring a parked bill back (F9). |
| `DELETE` | `/api/v1/held-bills/:id` | Discard a parked bill. |
| `GET` | `/api/v1/pos/batches` | Batches a cashier can sell from (?variantId, ?locationId). |
| `GET` | `/api/v1/pos/customers` | Customer picker search (?q). |
| `POST` | `/api/v1/pos/customers` | Quick-add a customer at the till. |
| `GET` | `/api/v1/pos/snapshot` | Offline catalogue snapshot for a till (?locationId). |
| `POST` | `/api/v1/pos/tills` | Register this device as a till ({ name }). |
| `POST` | `/api/v1/pos/offline-sales` | Sync bills made offline ({ deviceToken, sales }). |
| `POST` | `/api/v1/scan-sessions` | Pair a phone as a wireless scanner (returns a token; phones push to /api/scan/:token). |
| `DELETE` | `/api/v1/scan-sessions/:id` | End a phone-scanner pairing. |

### Customers, suppliers, khata

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/customers` | Customers (?q, ?due=1, ?page). |
| `GET` | `/api/v1/customers/:id` | Customer with bills, running-balance statement and totals. |
| `POST` | `/api/v1/customers` | Add a customer. |
| `PUT` | `/api/v1/customers/:id` | Update a customer. |
| `GET` | `/api/v1/suppliers` | Suppliers (?q, ?due=1, ?page). |
| `GET` | `/api/v1/suppliers/:id` | Supplier with purchases, statement and totals. |
| `POST` | `/api/v1/suppliers` | Add a supplier. |
| `PUT` | `/api/v1/suppliers/:id` | Update a supplier. |
| `PUT` | `/api/v1/parties/:id/active` | Archive or restore a customer/supplier ({ active }). |
| `GET` | `/api/v1/parties/:id/open-bills` | Unpaid bills a payment can be set against. |
| `POST` | `/api/v1/parties/:id/payments` | Record a payment (optionally against chosen bills). |
| `POST` | `/api/v1/parties/:id/udhaar` | Khata: udhaar given/taken without a bill. |
| `POST` | `/api/v1/ledger/:id/reverse` | Undo a khata entry or payment ({ reason }); owners/managers. |
| `GET` | `/api/v1/khata` | Khata balances (?tab=suppliers, ?q, ?page) with you'll get / you'll give totals. |

### Purchases

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/purchases` | Purchase orders and bills (?q, ?status, ?page). |
| `GET` | `/api/v1/purchases/:id` | Purchase with receipts, payments and attachments. |
| `POST` | `/api/v1/purchases` | Create a purchase order. |
| `PUT` | `/api/v1/purchases/:id` | Edit a purchase order. |
| `POST` | `/api/v1/purchases/:id/receive` | Receive goods (partial allowed). |
| `POST` | `/api/v1/purchases/:id/return` | Return goods to the supplier. |
| `POST` | `/api/v1/purchases/:id/cancel` | Cancel a purchase order. |
| `POST` | `/api/v1/purchases/:id/attachments` | Attach uploaded bill photos/PDFs ({ files }). |
| `DELETE` | `/api/v1/purchases/:id/attachments` | Remove an attachment ({ url }). |
| `POST` | `/api/v1/purchase-bills` | Record a supplier bill in one step (stock in + payment). |

### Settings, team, audit, import

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/settings` | Business, receipt, scanner and e-invoice settings (owner). |
| `PUT` | `/api/v1/settings/business` | Update business details. |
| `PUT` | `/api/v1/settings/receipt` | Update receipt and scanner settings. |
| `PUT` | `/api/v1/settings/einvoice` | Save GST e-invoice API settings. |
| `POST` | `/api/v1/settings/einvoice/test` | Test the e-invoice connection. |
| `GET` | `/api/v1/members` | Team members and pending invitations. |
| `POST` | `/api/v1/members/invitations` | Invite by email ({ email, role }). |
| `DELETE` | `/api/v1/members/invitations/:id` | Cancel an invitation. |
| `PUT` | `/api/v1/members/:id/role` | Change a member's role ({ role }). |
| `DELETE` | `/api/v1/members/:id` | Remove a member. |
| `GET` | `/api/v1/audit` | Audit log (?entity, ?q, ?page). |
| `POST` | `/api/v1/imports/preview` | Preview an Excel/CSV import (multipart: kind, file). |
| `POST` | `/api/v1/imports` | Run an Excel/CSV import (multipart: kind, file). |
