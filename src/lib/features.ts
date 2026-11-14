import type { Permission } from "./permissions";

/** Modules Concilio can switch on or off per business, from the provider portal. */
export const FEATURES = {
  offline: { label: "Offline billing", note: "Tills keep billing without internet and sync later" },
  batches: { label: "Batches & expiry", note: "First-expiry-first-out stock" },
  purchases: { label: "Purchasing & suppliers", note: "Purchase orders, supplier dues" },
  imports: { label: "Excel import", note: "Bulk import of products, customers, dues" },
  serials: { label: "Serial / IMEI tracking", note: "One record per serial number" },
  einvoice: { label: "GST e-invoice + e-way bill", note: "IRN generation and e-way bills" },
  multishop: { label: "Multiple shops & transfer", note: "More than one location, stock transfer" },
  audit: { label: "Audit log", note: "Who changed what and when" },
} as const;
export type Feature = keyof typeof FEATURES;
export const ALL_FEATURES = Object.keys(FEATURES) as Feature[];

/** What each plan on the pricing page includes. Staff cap is enforced when inviting. */
export const PLAN_PRESETS: Record<string, { features: Feature[]; maxStaff: number }> = {
  Dukaan: { features: [], maxStaff: 2 },
  Vyapaar: { features: ["offline", "batches", "purchases", "imports"], maxStaff: 6 },
  Business: { features: [...ALL_FEATURES], maxStaff: 0 },
};
export const PLAN_NAMES = [...Object.keys(PLAN_PRESETS), "Custom"] as const;

/** A business with no stored feature list (created before plans existed) keeps everything. */
export function effectiveFeatures(stored: readonly string[] | null | undefined): Feature[] {
  return stored ? ALL_FEATURES.filter((f) => stored.includes(f)) : [...ALL_FEATURES];
}

/** Permissions that only exist when a feature is switched on. */
const PERMISSION_FEATURE: Partial<Record<Permission, Feature>> = {
  "purchases:read": "purchases",
  "purchases:write": "purchases",
  "import:run": "imports",
  "audit:read": "audit",
};
export const featureFor = (p: Permission) => PERMISSION_FEATURE[p];
export const permissionOn = (features: readonly string[], p: Permission) => {
  const f = PERMISSION_FEATURE[p];
  return !f || features.includes(f);
};
