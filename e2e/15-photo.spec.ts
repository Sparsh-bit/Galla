import { expect, signIn, test } from "./fixtures";
import { OWNER } from "./test-users";

test("a big phone photo can be added to a product", async ({ page }) => {
  await signIn(page, OWNER.email, OWNER.password);
  await page.goto("/products/new");
  // 3 MB JPEG (real header, filler body): over the old 2 MB limit.
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(3 * 1024 * 1024)]);
  const upload = page.waitForResponse((r) => r.url().includes("/api/uploads") && r.request().method() === "POST");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "phone-photo.jpg", mimeType: "image/jpeg", buffer: jpeg });
  expect((await upload).status()).toBe(200);
  await expect(page.getByText(/Upload failed|too large|could not save/i)).toHaveCount(0);
});
