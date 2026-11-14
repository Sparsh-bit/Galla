import type { Metadata } from "next";
import { getOrgSettings, requireCtx } from "@/server/context";
import { reorderList } from "@/server/services/reports";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ReorderLists } from "@/components/inventory/reorder-lists";
import { countryCodeFor } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Reorder list" };

export default async function ReorderPage() {
  const ctx = await requireCtx("stock:read");
  const [groups, s] = await Promise.all([reorderList(ctx), getOrgSettings(ctx.orgId)]);
  return (
    <PageBody className="max-w-4xl">
      <PageHeader title="Reorder list" description="Everything that is running low, grouped by the supplier you last bought it from. Check the quantities and send each supplier a WhatsApp message." />
      <ReorderLists groups={groups} shop={s.receipt?.shopName?.trim() || ctx.orgName} countryCode={countryCodeFor(s.currency)} canBuy={true} />
    </PageBody>
  );
}
