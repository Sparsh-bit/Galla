import { expect, signIn, test } from "./fixtures";
import { OWNER } from "./test-users";

test("open apps are told when a new version is deployed", async ({ page, request }) => {
  test.setTimeout(90_000);
  const live = await (await request.get("/api/version")).json();
  expect(live.build).toBeTruthy();

  await signIn(page, OWNER.email, OWNER.password);
  // Same build: no prompt.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("A new version of Galla is ready")).toHaveCount(0);

  // A deploy happened: the next check offers a reload.
  await page.route("**/api/version", (route) => route.fulfill({ json: { build: "newer-build", minDesktopVersion: null } }));
  await page.waitForTimeout(31_000); // checks are spaced at least 30 s apart
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("A new version of Galla is ready")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
});
