import { expect, test, type APIRequestContext } from "@playwright/test";
import { CASHIER, OWNER } from "./test-users";

// The REST API the desktop and phone apps use: same rules as the web app, bearer-token auth.
test.describe.configure({ mode: "serial" });

const SAMPLE_BARCODE = "8901234567890"; // "Mineral Water 1L" from the onboarding sample data

async function signIn(request: APIRequestContext, user: { email: string; password: string }) {
  const res = await request.post("/api/v1/auth/sign-in", { data: { email: user.email, password: user.password } });
  expect(res.status(), await res.text()).toBe(200);
  const body = await res.json();
  expect(body.data.token, "sign-in returns a bearer token").toBeTruthy();
  return { Authorization: `Bearer ${body.data.token}` };
}

test("REST API: bearer auth, POS sale, khata, phone scanner and role rules", async ({ playwright, baseURL }) => {
  // A clean client with no cookies and no Origin header, like a native app.
  const api = await playwright.request.newContext({ baseURL });

  expect((await api.get("/api/v1/me")).status()).toBe(401);
  const index = (await (await api.get("/api/v1")).json()).data;
  expect(index.routes.length).toBeGreaterThan(80);
  expect(index.routes.find((r: { name: string }) => r.name === "sales.detail")?.path).toBe("/api/v1/sales/:saleId/detail");
  expect(index).toHaveProperty("minClientVersions");

  const wrong = await api.post("/api/v1/auth/sign-in", { data: { email: OWNER.email, password: "wrong-password-123" } });
  expect(wrong.status()).toBe(400);

  const owner = await signIn(api, OWNER);
  const me = (await (await api.get("/api/v1/me", { headers: owner })).json()).data;
  expect(me.user.email).toBe(OWNER.email);
  expect(me.business.role).toBe("owner");

  // Scan a barcode, then bill it.
  const loc = (await (await api.get("/api/v1/locations", { headers: owner })).json()).data[0];
  const hit = (await (await api.get(`/api/v1/products/lookup?code=${SAMPLE_BARCODE}&locationId=${loc._id}`, { headers: owner })).json()).data;
  expect(hit.name).toBe("Mineral Water 1L");
  const sale = await api.post("/api/v1/sales", { headers: owner, data: { locationId: loc._id, lines: [{ variantId: hit.variantId, qty: 2 }], payments: [{ method: "cash", amount: 1_000_000 }] } });
  expect(sale.status(), await sale.text()).toBe(200);
  const saleId = (await sale.json()).data.saleId ?? (await sale.json()).data.id;
  expect(saleId).toBeTruthy();
  const bill = (await (await api.get(`/api/v1/sales/${saleId}`, { headers: owner })).json()).data;
  expect(bill.sale.lines[0].name).toContain("Mineral Water");
  // The app's bill screen: receipt plus what this role may do.
  const saleDetail = (await (await api.get(`/api/v1/sales/${saleId}/detail`, { headers: owner })).json()).data;
  expect(saleDetail.receipt.sale.number).toBe(bill.sale.number);
  expect(saleDetail.canVoid).toBe(true);
  expect(saleDetail.lines[0]).toMatchObject({ index: 0, returned: 0 });
  expect((await (await api.get("/api/v1/sales", { headers: owner })).json()).data.items.some((s: { _id: string }) => s._id === saleId)).toBe(true);

  // Validation errors come back as 422 with field errors.
  const bad = await api.post("/api/v1/sales", { headers: owner, data: { locationId: loc._id, lines: [] } });
  expect(bad.status()).toBe(422);
  expect((await bad.json()).fieldErrors).toBeTruthy();

  // Khata: add a customer, give udhaar, see the balance, undo it with a reason.
  const cust = await api.post("/api/v1/customers", { headers: owner, data: { name: "API Khata Customer", phone: "9876500011" } });
  expect(cust.status(), await cust.text()).toBe(200);
  const custId = (await cust.json()).data.id;
  const udhaar = await api.post(`/api/v1/parties/${custId}/udhaar`, { headers: owner, data: { amount: 50000, note: "Rice on credit" } });
  expect(udhaar.status(), await udhaar.text()).toBe(200);
  let detail = (await (await api.get(`/api/v1/customers/${custId}`, { headers: owner })).json()).data;
  expect(detail.party.balance).toBe(50000);
  const entry = detail.statement.rows.at(-1);
  expect((await api.post(`/api/v1/ledger/${entry.id}/reverse`, { headers: owner, data: { reason: "Entered twice" } })).status()).toBe(200);
  detail = (await (await api.get(`/api/v1/customers/${custId}`, { headers: owner })).json()).data;
  expect(detail.party.balance).toBe(0);
  expect((await (await api.get("/api/v1/khata", { headers: owner })).json()).data).toHaveProperty("youGet");

  // Phone as a wireless scanner: pair, push a code, unpair.
  const pair = (await (await api.post("/api/v1/scan-sessions", { headers: owner })).json()).data;
  expect((await api.post(`/api/scan/${pair.token}`, { headers: owner, data: { code: SAMPLE_BARCODE } })).status()).toBe(200);
  expect((await api.delete(`/api/v1/scan-sessions/${pair.token}`, { headers: owner })).status()).toBe(200);

  // Owner-only and manager reads.
  for (const path of ["/dashboard", "/reports", "/products", "/stock", "/purchases", "/suppliers", "/settings", "/members", "/audit", "/serials", "/stock/moves", "/tax-rates", "/categories", "/products/form-data"]) {
    const res = await api.get(`/api/v1${path}`, { headers: owner });
    expect(res.status(), `${path}: ${await res.text()}`).toBe(200);
  }

  // A cashier can sell but not see reports, settings or cost prices.
  const cashier = await signIn(api, CASHIER);
  expect((await api.get("/api/v1/reports", { headers: cashier })).status()).toBe(403);
  expect((await api.get("/api/v1/settings", { headers: cashier })).status()).toBe(403);
  const asCashier = (await (await api.get(`/api/v1/products/lookup?code=${SAMPLE_BARCODE}`, { headers: cashier })).json()).data;
  expect(asCashier.costPrice).toBe(0);
  const products = (await (await api.get("/api/v1/products", { headers: cashier })).json()).data.items;
  expect(products.every((p: { variants: { costPrice: number }[] }) => p.variants.every((v) => v.costPrice === 0))).toBe(true);

  // Unknown routes and cross-site cookie writes are refused.
  expect((await api.get("/api/v1/nope", { headers: owner })).status()).toBe(404);
  await api.dispose();
});

test("REST API: browser cookie writes from another site are refused", async ({ page, baseURL }) => {
  // Sign in through the API in the browser context so it holds a session cookie.
  const res = await page.request.post("/api/v1/auth/sign-in", { data: { email: OWNER.email, password: OWNER.password } });
  expect(res.status()).toBe(200);
  const forged = await page.request.post("/api/v1/customers", { headers: { Origin: "https://evil.example" }, data: { name: "Forged" } });
  expect(forged.status()).toBe(403);
  const same = await page.request.post("/api/v1/customers", { headers: { Origin: new URL(baseURL!).origin }, data: { name: "Same-origin Customer" } });
  expect(same.status(), await same.text()).toBe(200);
});
