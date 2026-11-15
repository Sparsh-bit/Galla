import { expect, signIn, test } from "./fixtures";
import { OWNER } from "./test-users";

// The rule: stock is kept only for items that have a real barcode. No barcode: no stock, always sellable.
test("no barcode = no stock (always sellable); barcode = stock kept", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, OWNER.email, OWNER.password);

  // An item with no barcode: no opening-stock field, "No stock kept" in the list, sells with nothing in stock.
  await page.goto("/products/new");
  await page.getByLabel("Product name").fill("E2E Plain Tea");
  await page.getByLabel("Selling price", { exact: true }).fill("15");
  await expect(page.getByLabel(/Opening stock/)).toHaveCount(0);
  await expect(page.getByText(/No barcode, so no stock is kept/)).toBeVisible();
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Product created")).toBeVisible();
  await page.goto("/products?q=Plain%20Tea");
  await expect(page.getByRole("row", { name: /E2E Plain Tea/ }).getByText("No stock kept")).toBeVisible();

  await page.goto("/pos");
  await page.getByRole("textbox", { name: "Search product or scan barcode" }).fill("Plain Tea");
  await page.getByRole("button", { name: /E2E Plain Tea/ }).first().click();
  await expect(page.getByText(/^Only \d/)).toHaveCount(0); // never "Only 0 in stock"
  await page.keyboard.press("F4");
  await page.getByRole("dialog", { name: "Take payment" }).getByRole("button", { name: /Complete sale/ }).click();
  await expect(page.getByRole("dialog", { name: "Sale complete" })).toBeVisible();
  await page.getByRole("button", { name: /New sale/ }).click();

  // An item with a barcode keeps stock.
  await page.goto("/products/new");
  await page.getByLabel("Product name").fill("E2E Scanned Soap");
  await page.getByLabel("Selling price", { exact: true }).fill("30");
  await page.getByPlaceholder("Scan or type").first().fill("8908001234567");
  await page.getByLabel(/Opening stock/).fill("5");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Product created")).toBeVisible();
  await page.goto("/products?q=Scanned%20Soap");
  await expect(page.getByRole("row", { name: /E2E Scanned Soap/ }).getByText(/5 pcs/)).toBeVisible();

  // The stock screens list only items that keep stock.
  await page.goto("/inventory");
  await expect(page.getByText("E2E Scanned Soap")).toBeVisible();
  await expect(page.getByText("E2E Plain Tea")).toHaveCount(0);
});
