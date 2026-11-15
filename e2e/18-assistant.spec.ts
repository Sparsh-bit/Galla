import { expect, signIn, test } from "./fixtures";
import { OWNER } from "./test-users";

test("Ask Galla opens, ", async ({ page }) => {
  await signIn(page, OWNER.email, OWNER.password);
  await page.getByRole("button", { name: /Ask Galla/ }).click();
  const panel = page.getByRole("dialog", { name: /Ask Galla/ });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "What is running low?" }).click();
  await expect(panel.getByText("What is running low?").first()).toBeVisible();
  // The test server talks to a stand-in AI: its answer must appear in the chat.
  await expect(panel.getByText("MOCK-ASSISTANT-REPLY")).toBeVisible({ timeout: 20_000 });
  await panel.getByLabel("Your question").fill("Hello");
  await expect(panel.getByRole("button", { name: "Send" })).toBeEnabled();
});
