import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test as base, type Page } from "@playwright/test";

/** Every test fails if the browser logs a console error or throws. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`[console] ${m.text()} @ ${page.url()}`);
      });
      page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message} @ ${page.url()}`));
      await use(errors);
      expect(errors, "browser console errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Latest link emailed to `to` (MAIL_SINK=file writes to the isolated E2E data directory). */
export async function lastMailLink(to: string, subject?: RegExp): Promise<string> {
  const mailFile = path.join(process.env.E2E_DATA_DIR ?? ".data/e2e", "mail.log");
  for (let i = 0; i < 30; i++) {
    const lines = (await readFile(mailFile, "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
    const hit = lines.map((l) => JSON.parse(l) as { to: string; subject: string; url?: string }).reverse().find((m) => m.to === to && m.url && (!subject || subject.test(m.subject)));
    if (hit?.url) return hit.url.replace(/^https?:\/\/[^/]+/, "");
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email for ${to}`);
}

// The server allows 30 sign-ins per 15 minutes per address. A run with this many tests would use them all up, so a
// user signs in once and later tests reuse that session (saved per user for this run only).
const sessions = (email: string) => path.resolve(process.env.E2E_DATA_DIR ?? ".data/e2e", `session-${email.replace(/[^a-z0-9]/gi, "_")}.json`);

export async function signIn(page: Page, email: string, password: string) {
  const file = sessions(email);
  try {
    const saved = JSON.parse(await readFile(file, "utf8")) as { cookies: unknown[] };
    await page.context().addCookies(saved.cookies as never);
    await page.goto("/dashboard");
    if (/\/(dashboard|onboarding)/.test(new URL(page.url()).pathname)) {
      await page.waitForLoadState("networkidle");
      return;
    }
  } catch {
    /* no saved session yet, or it no longer works: sign in below */
  }
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
  await page.waitForLoadState("networkidle");
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ cookies: await page.context().cookies() }));
}

export async function signUp(page: Page, user: { name: string; email: string; password: string }, next?: string) {
  await page.goto(next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up");
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/verify-email/);
  await page.goto(await lastMailLink(user.email, /Verify/));
}

/** Simulates a USB keyboard-wedge barcode scanner (keys a few ms apart + Enter). */
export async function scan(page: Page, code: string) {
  await page.evaluate(async (c) => {
    (document.activeElement as HTMLElement | null)?.blur();
    for (const key of [...c, "Enter"]) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 4));
    }
  }, code);
}
