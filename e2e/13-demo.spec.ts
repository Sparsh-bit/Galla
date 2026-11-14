import { expect, test } from "./fixtures";

// Runs only against a server started with DEMO_MODE=true:  E2E_DEMO=1 npx playwright test e2e/13-demo.spec.ts
test.skip(!process.env.E2E_DEMO, "needs DEMO_MODE=true");

test("demo: enquiry first, then straight into a sample shop with no login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await page.getByRole("link", { name: "Try the demo" }).first().click();
  await page.waitForURL(/\/demo$/);

  // Sign-in is not part of the demo site.
  await page.goto("/sign-in");
  await page.waitForURL(/\/demo$/);

  // Nothing opens without the enquiry.
  await page.goto("/dashboard");
  await page.waitForURL(/\/demo$/);
  await page.getByRole("button", { name: /Open the demo/ }).click();
  await expect(page.getByLabel("Your name")).toBeFocused().catch(() => undefined);
  await expect(page).toHaveURL(/\/demo$/);

  await page.getByLabel("Your name").fill("Ravi Kumar");
  await page.getByLabel("Phone / WhatsApp").fill("+91 98765 43210");
  await page.getByLabel("Shop or business name").fill("Ravi General Store");
  await page.getByRole("button", { name: /Open the demo/ }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText(/You are in the Galla demo/)).toBeVisible();

  // Sample products are there and billing works.
  await page.goto("/pos");
  await expect(page.getByRole("button", { name: /Ball Pen Blue/ })).toBeVisible();
  // Modules outside the demo stay off.
  await page.goto("/settings/einvoice");
  await page.waitForURL(/\/forbidden/);
});
