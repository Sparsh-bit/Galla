import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { PROVIDER } from "./test-users";

test.describe.configure({ mode: "serial" });

const SELLER = { store: "E2E Provider Kirana", owner: "Pooja Seller", email: "seller@galla.test", password: "Seller-Pass-2026!", newPassword: "Seller-Pass-2027!" };

async function providerSignIn(page: Page) {
  await page.goto("/provider");
  await page.waitForURL(/\/provider\/sign-in/);
  await page.getByLabel("Email").fill(PROVIDER.email);
  await page.getByLabel("Password", { exact: true }).fill(PROVIDER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/provider$/);
}

async function sellerSignIn(page: Page, password = SELLER.password) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(SELLER.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("provider creates a seller, locks, unlocks, records a payment and deletes them", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  await providerSignIn(page);
  await expect(page.getByRole("heading", { name: "Sellers" })).toBeVisible();

  // Create the seller: their login and their store.
  await page.getByRole("button", { name: "New seller" }).click();
  await page.getByLabel("Store name").fill(SELLER.store);
  await page.getByLabel("Owner name").fill(SELLER.owner);
  await page.getByLabel("Login email (username)").fill(SELLER.email);
  await page.getByLabel("Password", { exact: true }).fill(SELLER.password);
  await page.getByRole("button", { name: "Create seller" }).click();
  await page.waitForURL(/\/provider\/sellers\/[a-f0-9]{24}$/);
  await expect(page.getByRole("heading", { name: SELLER.store })).toBeVisible();
  const sellerUrl = page.url();

  // The seller signs in and lands in their own empty store.
  const ctx = await browser.newContext({ baseURL });
  const seller = await ctx.newPage();
  await sellerSignIn(seller);
  await seller.waitForURL(/\/dashboard/);
  await expect(seller.getByText(SELLER.store).first()).toBeVisible();

  // Plan toggles: Dukaan has no purchasing; switching to Business turns it on for the seller at once.
  await expect(seller.getByRole("link", { name: "Purchases" })).toHaveCount(0);
  await seller.goto("/purchases");
  await seller.waitForURL(/\/forbidden/);
  await page.getByLabel("Plan", { exact: true }).selectOption("Business");
  await page.getByRole("button", { name: "Save subscription" }).click();
  await expect(page.getByText("Subscription saved")).toBeVisible();
  await seller.goto("/dashboard");
  await expect(seller.getByRole("link", { name: "Purchases" })).toBeVisible();

  // Lock: the seller is signed out everywhere and can't sign back in.
  await page.getByRole("button", { name: "Lock now" }).click();
  await expect(page.getByText("Seller locked and signed out everywhere")).toBeVisible();
  await seller.goto("/dashboard");
  await seller.waitForURL(/\/sign-in/);
  await sellerSignIn(seller);
  await expect(seller.getByText(/subscription has expired or this account is locked/)).toBeVisible();
  const api = await seller.request.post("/api/v1/auth/sign-in", { data: { email: SELLER.email, password: SELLER.password } });
  expect(api.status()).toBe(402);

  // Unlock, record a payment (extends paid-until), reset the owner password.
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Seller unlocked")).toBeVisible();
  await page.getByLabel("Amount (₹)").fill("999");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("cell", { name: "₹999.00" })).toBeVisible();
  await page.getByLabel("New password").fill(SELLER.newPassword);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByText("Password reset")).toBeVisible();
  await sellerSignIn(seller, SELLER.newPassword);
  await seller.waitForURL(/\/dashboard/);

  // Expired subscription locks too: set paid-until in the past.
  await page.getByLabel("Paid until").first().fill("2020-01-01");
  await page.getByRole("button", { name: "Save subscription" }).click();
  await expect(page.getByText("Subscription saved")).toBeVisible();
  await seller.goto("/dashboard");
  await seller.waitForURL(/\/locked/);
  await expect(seller.getByRole("heading", { name: "Your subscription has expired" })).toBeVisible();

  // Delete permanently: the login is gone too.
  await page.goto(sellerUrl);
  await page.getByLabel(`Type “${SELLER.store}” to confirm`).fill(SELLER.store);
  await page.getByRole("button", { name: "Delete seller" }).click();
  await page.waitForURL(/\/provider$/);
  await expect(page.getByRole("link", { name: SELLER.store })).toHaveCount(0); // the audit log still names it, on purpose
  const gone = await seller.request.post("/api/v1/auth/sign-in", { data: { email: SELLER.email, password: SELLER.newPassword } });
  expect(gone.status()).toBe(400);
  await ctx.close();
});

test("the provider portal is closed to everyone else", async ({ page }) => {
  await page.goto("/provider");
  await page.waitForURL(/\/provider\/sign-in/);
  await page.getByLabel("Email").fill("owner@stockpilot.test");
  await page.getByLabel("Password", { exact: true }).fill("Local-Test-Pass-2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("This account doesn't have provider access.")).toBeVisible();
  await page.goto("/provider");
  await page.waitForURL(/\/provider\/sign-in/);
});
