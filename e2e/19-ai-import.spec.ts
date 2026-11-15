import sharp from "sharp";
import { expect, signIn, test } from "./fixtures";
import { OWNER } from "./test-users";

/** A menu photo as a phone would take it: printed text on white, slightly large. */
async function menuPhoto() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="560"><rect width="100%" height="100%" fill="white"/><text x="40" y="70" font-size="46" font-family="Arial" font-weight="bold">SHARMA CAFE MENU</text><text x="40" y="160" font-size="36" font-family="Arial">Paneer Tikka Half</text><text x="820" y="160" font-size="36" font-family="Arial">180/-</text><text x="40" y="225" font-size="36" font-family="Arial">Paneer Tikka Full</text><text x="820" y="225" font-size="36" font-family="Arial">320/-</text><text x="40" y="290" font-size="36" font-family="Arial">Masala Chai</text><text x="820" y="290" font-size="36" font-family="Arial">Rs. 25</text><text x="40" y="355" font-size="36" font-family="Arial">Cold Coffee</text><text x="820" y="355" font-size="36" font-family="Arial">90</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

test("AI import: a menu photo becomes editable products with prices and no cost price", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, OWNER.email, OWNER.password);
  await page.goto("/products/ai");
  await page.locator('input[type="file"][accept^="image/jpeg"]').setInputFiles({ name: "menu.jpg", mimeType: "image/jpeg", buffer: await menuPhoto() });

  // The photo is read (text reader, then the AI) and the items appear to check.
  await expect(page.getByText(/Check the items/)).toBeVisible({ timeout: 90_000 });
  const names = page.getByLabel("Name");
  await expect(names).toHaveCount(4);
  await expect(page.getByLabel("Price", { exact: true }).first()).toHaveValue("180");
  await expect(page.getByLabel("Price", { exact: true }).nth(2)).toHaveValue("25");
  await expect(page.getByLabel("Cost price (optional)").first()).toHaveValue("");

  // Fix a price, then add: no cost price needed.
  await page.getByLabel("Price", { exact: true }).nth(3).fill("95");
  await page.getByRole("button", { name: /^Add 4 products$/ }).click();
  await expect(page.getByText("4 products added")).toBeVisible({ timeout: 30_000 });

  // Every item got a short number (at most 3 digits), listed to note down.
  const list = page.getByRole("list", { name: "Product numbers" });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  const numbers = (await list.getByRole("listitem").evaluateAll((els) => els.map((e) => e.textContent ?? ""))).map((t) => /^(\d+)/.exec(t)![1]);
  expect(numbers.every((n) => /^[1-9]\d{0,2}$/.test(n))).toBe(true);
  expect(new Set(numbers).size).toBe(4);
  const chai = (await list.getByRole("listitem").filter({ hasText: "Masala Chai" }).textContent())!.match(/^(\d+)/)![1];

  // That number bills the item on the number pad.
  await page.goto("/pos");
  await page.getByRole("button", { name: "Product number pad" }).click();
  const pad = page.getByRole("dialog", { name: /Product number/ });
  for (const d of chai) await pad.getByRole("button", { name: d, exact: true }).click();
  await expect(pad.getByText("Masala Chai")).toBeVisible();
  await pad.getByRole("button", { name: /Next/ }).click();
  await expect(pad.getByText("Added: Masala Chai")).toBeVisible();

  // Menu items have no barcode, so no stock is kept: they show it, and they sell without any stock.
  await page.goto("/products?q=Masala");
  await expect(page.getByRole("row", { name: /Masala Chai/ }).getByText("No stock kept")).toBeVisible();
});
