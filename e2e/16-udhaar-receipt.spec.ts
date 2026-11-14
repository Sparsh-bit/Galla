import { expect, signIn, test } from "./fixtures";
import { OWNER } from "./test-users";

test("udhaar: customer is required, part payment is asked, the rest is calculated and the bill is findable", async ({ page }) => {
  await signIn(page, OWNER.email, OWNER.password);
  await page.goto("/pos");
  await page.getByRole("button", { name: /Ball Pen Blue/ }).click();
  await page.keyboard.press("F4");
  const dialog = page.getByRole("dialog", { name: "Take payment" });
  await dialog.getByRole("radio", { name: /Udhaar/ }).click();

  // No customer yet: it cannot be saved.
  await expect(dialog.getByText(/Pick or add the customer/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save on udhaar" })).toBeDisabled();

  await dialog.getByRole("button", { name: /Walk-in customer/ }).click();
  await page.getByPlaceholder("Name, phone or GSTIN…").fill("Walk-in Regular");
  await page.getByRole("option", { name: /^Walk-in Regular/ }).click();

  // Paid ₹4 of ₹10: ₹6 goes to udhaar.
  await dialog.getByLabel(/Paid now/).fill("4");
  await expect(dialog.getByText("₹6.00")).toBeVisible();
  // Paying everything is not udhaar.
  await dialog.getByLabel(/Paid now/).fill("10");
  await expect(dialog.getByText(/choose Paid in full/)).toBeVisible();
  await dialog.getByLabel(/Paid now/).fill("4");
  await dialog.getByRole("button", { name: "Save on udhaar" }).click();
  await expect(page.getByRole("dialog", { name: "Sale complete" })).toBeVisible();
  await page.getByRole("button", { name: /New sale/ }).click();

  // Find it: udhaar filter shows it with the amount due; the paid filter does not.
  await page.goto("/sales?type=credit");
  await expect(page.getByText("Udhaar · due ₹6.00").first()).toBeVisible();
  await page.goto("/sales?type=paid");
  await expect(page.getByText("Udhaar · due ₹6.00")).toHaveCount(0);
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
});

test("receipt: the owner sets a shop name and words behind the bill", async ({ page }) => {
  await signIn(page, OWNER.email, OWNER.password);
  await page.goto("/settings/receipt");
  await page.getByLabel("Shop name on the bill").fill("Sharma Kirana & Co");
  await page.getByRole("radio", { name: "Words" }).click();
  await page.getByLabel("Words behind the bill").fill("THANK YOU");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  await page.goto("/sales");
  await page.getByRole("link", { name: /^(INV|S)\// }).first().click();
  await page.waitForURL(/\/sales\/[a-f0-9]{24}$/);
  const id = page.url().split("/").pop()!;
  await page.goto(`/print/receipt/${id}`);
  await expect(page.getByRole("heading", { name: "Sharma Kirana & Co" })).toBeVisible();
  await expect(page.getByText("THANK YOU", { exact: true })).toBeVisible();
});
