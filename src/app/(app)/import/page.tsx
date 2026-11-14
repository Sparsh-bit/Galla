import type { Metadata } from "next";
import { requireCtx, allowed } from "@/server/context";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ImportWizard } from "@/components/import/import-wizard";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  const ctx = await requireCtx("import:run");
  const kinds = (
    [
      ["products", "Products", allowed(ctx, "products:write")],
      ["customers", "Customers", allowed(ctx, "parties:write")],
      ["suppliers", "Suppliers", allowed(ctx, "purchases:write")],
    ] as const
  ).filter(([, , ok]) => ok).map(([k, l]) => ({ value: k, label: l }));
  return (
    <PageBody className="max-w-4xl">
      <PageHeader title="Import data" description="Bring in products, customers or suppliers from Excel or CSV. Existing SKUs/phones are updated, new ones are created." />
      <ImportWizard kinds={kinds} />
    </PageBody>
  );
}
