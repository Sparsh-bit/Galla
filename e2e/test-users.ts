// Local-only test accounts used by Playwright runs against the e2e database on http://localhost:3100.
const password = "Local-Test-Pass-2026!";
export const OWNER = { name: "Asha Owner", email: "owner@stockpilot.test", password };
export const MANAGER = { name: "Manu Manager", email: "manager@stockpilot.test", password };
export const CASHIER = { name: "Cal Cashier", email: "cashier@stockpilot.test", password };
export const STOCKKEEPER = { name: "Sam Stock", email: "stock@stockpilot.test", password };
// Provider-portal admin for the e2e server only (the real admin is set in Railway, never in code).
export const PROVIDER = { email: "provider@galla.test", password: "Local-Provider-Pass-2026!" };
