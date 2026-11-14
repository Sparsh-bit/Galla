# Database security and multi-tenancy

How Galla keeps one seller's data away from everyone else, and what must be set on the hosting side
(MongoDB Atlas, Railway) because code alone can't enforce it. Nothing here is a secret.

## 1. What the code guarantees

| Layer | Guarantee | Where | Proof |
|---|---|---|---|
| Tenant scope | Every collection that holds business data carries `orgId`. A Mongoose plugin **throws before the query runs** if a find/update/delete/count/aggregate doesn't name the business. | `src/server/models/tenant-plugin.ts` | `tests/unit/tenancy.test.ts` checks **every model**, and fails if a new collection is added without scope or an explicit "global" entry |
| Who may ask | The business comes from the signed-in session (`loadCtx`), never from the request body. Role permissions are checked on every action and API route. | `src/server/context.ts`, `with-auth.ts`, `api/handler.ts` | `tests/integration/roles.test.ts` (cross-tenant and role cases), `e2e/01-roles`, `e2e/09-api` |
| Locked sellers | A locked or expired business is dropped from the session context, so every screen and API call refuses it (HTTP 402). Sessions are deleted when the provider locks. | `context.ts`, `services/provider.ts` | `e2e/12-provider` |
| Input | Every action and route validates input with strict Zod schemas (unknown fields rejected); ids must be 24-hex; no raw operators reach a query. | `lib/schemas.ts`, `with-auth.ts` | unit + integration tests |
| Secrets in the database | E-invoice (GST API) credentials are encrypted with `ENCRYPTION_KEY` (AES-GCM) before storage. Passwords are hashed by Better Auth (scrypt). | `server/crypto.ts` | `tests/unit/einvoice.test.ts` |
| Files | Uploads are stored per business and served only to members of that business; magic-byte checks, size limits, rate limits. | `api/uploads`, `api/org-files`, `api/docs` | `tests/unit/file-access.test.ts` |
| Provider access | Only users listed in `ProviderAdmin` reach `/provider`; every provider action is written to `ProviderAudit`. Sign-in for non-admins is refused before a session exists. | `services/provider.ts` | `e2e/12-provider` |
| Public API abuse | Per-client request cap on `/api/v1`; sign-in throttled per IP and per account (5 failures → 15 min). | `api/handler.ts`, `server/auth.ts` | `e2e/09-api` |

Deliberately **global** (not per business): `Subscription` (keyed by `orgId`, provider-managed), `ProviderAdmin`,
`ProviderAudit`, `LoginAttempt`, `RateLimit`. They are listed in the tenancy test; adding to that list is a
conscious decision.

## 2. What you must set on the hosting side (cannot be done from code)

**MongoDB Atlas**
1. **Dedicated database user for Galla**, role `readWrite` on the `galla` database only. Not `atlasAdmin`, not `readWriteAnyDatabase`. Use a different user for the demo database.
2. **Network Access**: Railway has no fixed outbound address on the Hobby plan, so the allow-list is `0.0.0.0/0` **only because the database is also protected by the user/password and TLS**. To close it properly: Railway Pro **static outbound IPs**, or Atlas **Private Endpoint / VPC peering**, then remove `0.0.0.0/0`.
3. **Strong generated password** (32+ chars, no reuse). Rotate it if it ever appeared in a chat, screenshot or log. Update `MONGODB_URI` in Railway afterwards.
4. **TLS** is on by default for `mongodb+srv://`; never use `tls=false` / `tlsAllowInvalidCertificates`.
5. **Encryption at rest** is on for Atlas clusters (M10+ and Flex use encrypted volumes). For the strongest option enable customer-managed keys.
6. **Backups**: continuous cloud backup with point-in-time recovery (M10+). Test a restore once.
7. **Alerts + audit**: turn on Atlas alerts (failed auth, connections spike, disk). On M10+ enable database auditing.
8. **Separate databases**: `galla` for real shops, `galla_demo` for galla.concilio.solutions, so demo sign-ups can never touch real data.

**Railway**
- `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `MONGODB_URI`, `RESEND_API_KEY` only as service variables (never in the repo). `ENCRYPTION_KEY` must never change once e-invoice credentials are saved.
- Remove `PROVIDER_ADMIN_PASSWORD` after the first provider sign-in.
- Region: Southeast Asia (Singapore), the same region as the database.
- Keep repositories private once the apps are published; the apps use the public `galla-releases` repo or this server for downloads.

## 3. Operating rules
- No one connects a client (Compass, mongosh) to production except for a planned task; use a read-only Atlas user for support.
- Deleting a seller in the provider portal erases their documents, files and logins (see `deleteSeller`); backups keep them until they expire. State this retention in the privacy notice.
- Run `npm audit` and keep Dependabot PRs merged weekly.
