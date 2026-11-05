import { expect, signIn, test } from "./fixtures";
import { OWNER } from "./test-users";

const SAMPLE_BARCODE = "8901234567890"; // "Mineral Water 1L" from the onboarding sample data

test("a linked phone scans on every screen and chooses sale or product", async ({ page }) => {
  await signIn(page, OWNER.email, OWNER.password);
  await page.evaluate(() => localStorage.setItem("stockpilot.printer", JSON.stringify({ autoPrint: false })));

  // Link once, from any screen.
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Link a phone as scanner" }).click();
  await expect(page.getByAltText("Pairing QR code")).toBeVisible();
  await expect(page.getByText("Phone linked. Listening for scans…")).toBeVisible();
  const token = await page.evaluate(() => sessionStorage.getItem("galla.phoneLink"));
  expect(token).toBeTruthy();
  await page.keyboard.press("Escape");

  // The phone (same business, its own session) sends a scan "to the product": the computer opens it.
  const phone = page.context().request;
  const push = (target: string) => phone.post(`/api/scan/${token}`, { data: { code: SAMPLE_BARCODE, target }, headers: { Origin: new URL(page.url()).origin } });
  expect((await push("product")).status()).toBe(200);
  await page.waitForURL(/\/products\/[a-f0-9]{24}$/);
  await expect(page.locator("h1").first()).toContainText("Mineral Water");

  // "To the sale" from another screen: jumps to the POS and adds it to the cart.
  expect((await push("sale")).status()).toBe(200);
  await page.waitForURL(/\/pos$/);
  await expect(page.getByRole("list", { name: "Cart items" }).getByText("Mineral Water 1L")).toBeVisible();

  // The link survives navigation; unlinking ends it on the server.
  const linked = page.getByRole("button", { name: "Phone linked" });
  await expect(linked).toHaveCount(2); // header + POS toolbar
  await linked.last().click();
  await page.getByRole("button", { name: "Unlink phone" }).click();
  expect((await push("here")).status()).toBe(410);
});
