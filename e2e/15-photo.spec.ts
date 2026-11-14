import sharp from "sharp";
import { expect, signIn, test } from "./fixtures";
import { OWNER } from "./test-users";

/** A real camera-sized photo: 4000×3000 noise, several MB as a JPEG. */
async function bigPhoto() {
  const raw = Buffer.alloc(4000 * 3000 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  return sharp(raw, { raw: { width: 4000, height: 3000, channels: 3 } }).jpeg({ quality: 70 }).toBuffer();
}

test("a big camera photo is accepted and shrunk automatically", async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  await signIn(page, OWNER.email, OWNER.password);
  await page.goto("/products/new");
  const jpeg = await bigPhoto();
  expect(jpeg.length).toBeGreaterThan(3 * 1024 * 1024);
  expect(jpeg.length).toBeLessThan(14 * 1024 * 1024);

  // Through the product form (the browser shrinks it, the server checks it again).
  const upload = page.waitForResponse((r) => r.url().includes("/api/uploads") && r.request().method() === "POST");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "phone-photo.jpg", mimeType: "image/jpeg", buffer: jpeg });
  expect((await upload).status()).toBe(200);
  await expect(page.getByText(/Upload failed|too large|could not/i)).toHaveCount(0);

  // As the Android app sends it (original size, crop=square): a centred, much smaller square comes back.
  const res = await page.request.post("/api/uploads", { headers: { origin: baseURL! }, multipart: { crop: "square", file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: jpeg } } });
  expect(res.status()).toBe(200);
  const { url } = (await res.json()) as { url: string };
  const stored = await page.request.get(url);
  const body = await stored.body();
  const meta = await sharp(body).metadata();
  expect([meta.width, meta.height]).toEqual([1200, 1200]);
  expect(body.length).toBeLessThan(1.5 * 1024 * 1024);
});
