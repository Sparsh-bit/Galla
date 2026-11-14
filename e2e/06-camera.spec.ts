import { existsSync } from "node:fs";
import path from "node:path";
import { expect, signIn, test } from "./fixtures";
import { OWNER } from "./test-users";

// Chrome reads this video file as its webcam (made by global setup from a real EAN-13 barcode).
const VIDEO = path.resolve(process.env.E2E_DATA_DIR ?? ".data/e2e", "fake-webcam.y4m");
test.use({
  permissions: ["camera"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${VIDEO}`] },
});

test("laptop/phone camera scans a barcode into the POS cart", async ({ page }) => {
  test.skip(!existsSync(VIDEO), "ffmpeg not installed, fake webcam unavailable");
  await signIn(page, OWNER.email, OWNER.password);
  await page.evaluate(() => localStorage.setItem("stockpilot.printer", JSON.stringify({ autoPrint: false })));
  await page.goto("/pos");
  await page.getByRole("button", { name: "Scan with camera" }).click();
  await expect(page.getByRole("dialog", { name: "Scan barcode" })).toBeVisible();
  // The camera stays open for the next item; the barcode held in view is added exactly once.
  await expect(page.getByRole("status").filter({ hasText: "Added: Mineral Water 1L" })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  await expect(page.getByRole("dialog", { name: "Already added" })).toHaveCount(0);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog", { name: "Scan barcode" })).toBeHidden();
  const cart = page.getByRole("list", { name: "Cart items" });
  await expect(cart.getByText("Mineral Water 1L")).toBeVisible();
  await expect(cart.getByRole("textbox", { name: /Quantity of Mineral Water/ })).toHaveValue("1");
  await expect(page.getByRole("button", { name: /Pay ₹20\.00/ })).toBeVisible();
});
