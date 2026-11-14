import { expect, test, signIn } from "./fixtures";
import { OWNER } from "./test-users";

const PEN_CODE = "8901234567920"; // Ball Pen Blue (sample product)

test("number pad: type, check the name, Next adds it and is ready for the next; a repeat asks first", async ({ page }) => {
  await signIn(page, OWNER.email, OWNER.password);
  await page.goto("/pos");
  await page.getByRole("button", { name: "Product number pad" }).click();
  const pad = page.getByRole("dialog", { name: /Product number/ });
  await expect(pad.getByRole("button", { name: /Next/ })).toBeDisabled();

  // A wrong number can't be sent.
  for (const d of "999") await pad.getByRole("button", { name: d, exact: true }).click();
  await expect(pad.getByText("No product has the number 999.")).toBeVisible();
  await expect(pad.getByRole("button", { name: /Next/ })).toBeDisabled();
  await pad.getByRole("button", { name: "Clear number" }).click();

  // The right number shows the product before it is added.
  for (const d of PEN_CODE) await pad.getByRole("button", { name: d, exact: true }).click();
  await expect(pad.getByText("Ball Pen Blue")).toBeVisible();
  await pad.getByRole("button", { name: /Next/ }).click();
  await expect(pad.getByText("Added: Ball Pen Blue")).toBeVisible();
  await expect(pad.getByLabel(/Number typed: none/)).toBeVisible(); // ready for the next number

  // The same product again asks first; saying no leaves the bill alone.
  for (const d of PEN_CODE) await pad.getByRole("button", { name: d, exact: true }).click();
  await expect(pad.getByText(/Already in bill ×1/)).toBeVisible();
  await pad.getByRole("button", { name: /Next/ }).click();
  const ask = page.getByRole("dialog", { name: "Already added" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: /^No, keep 1/ }).click();
  await expect(ask).toBeHidden();

  // Keyboard works as well: digits then Enter, and "yes" adds one more.
  await page.keyboard.type(PEN_CODE);
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Already added" }).getByRole("button", { name: "Yes, add one more" }).click();
  await pad.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: /Pay ₹20\.00/ }).or(page.getByRole("button", { name: /2 items/ }))).toBeVisible();
});
