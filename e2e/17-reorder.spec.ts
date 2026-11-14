import { expect, signIn, test } from "./fixtures";
import { OWNER } from "./test-users";

test("reorder list: a low item appears, quantities can be edited, the WhatsApp message is ready", async ({ page }) => {
  await signIn(page, OWNER.email, OWNER.password);
  await page.goto("/products/new");
  await page.getByLabel("Product name").fill("E2E Reorder Soap");
  await page.getByLabel("Selling price", { exact: true }).fill("30");
  await page.getByLabel(/Opening stock/).fill("2");
  await page.getByLabel(/Low stock alert/).fill("10");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Product created")).toBeVisible();

  await page.goto("/inventory/reorder");
  const card = page.locator("div").filter({ has: page.getByText("E2E Reorder Soap") }).filter({ has: page.getByRole("link", { name: /WhatsApp/ }) }).last();
  await expect(card.getByText("E2E Reorder Soap", { exact: true })).toBeVisible();
  // 10 is the level, 2 in stock: the suggestion is back to twice the level (20 - 2 = 18).
  const qty = card.getByLabel("Order quantity for E2E Reorder Soap");
  await expect(qty).toHaveValue("18");
  await qty.fill("25");
  const href = await card.getByRole("link", { name: /WhatsApp/ }).getAttribute("href");
  expect(href).toContain("https://wa.me/");
  expect(decodeURIComponent(href!)).toContain("E2E Reorder Soap - 25 pcs");
});
