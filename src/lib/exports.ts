import type { Permission } from "./permissions";

// Excel/CSV downloads at GET /api/export/<name>?from&to&format=xlsx|csv, shared with the apps.
export const EXPORT_REPORTS = {
  sales: { permission: "reports:read", title: "Sales" },
  products: { permission: "products:read", title: "Products" },
  stock: { permission: "reports:read", title: "Stock valuation" },
  gst: { permission: "reports:read", title: "GST HSN summary" },
  customers: { permission: "parties:read", title: "Customers" },
  suppliers: { permission: "purchases:read", title: "Suppliers" },
  movements: { permission: "stock:read", title: "Stock movements" },
} as const satisfies Record<string, { permission: Permission; title: string }>;
export type ExportReport = keyof typeof EXPORT_REPORTS;
