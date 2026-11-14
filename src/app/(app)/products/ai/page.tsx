import type { Metadata } from "next";
import { env } from "@/env";
import { requireCtx } from "@/server/context";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { MenuImport } from "@/components/import/menu-import";

export const metadata: Metadata = { title: "Add products from a photo or PDF" };

export default async function AiImportPage() {
  await requireCtx("products:write");
  return (
    <PageBody className="max-w-4xl">
      <PageHeader title="Add products from a photo or PDF" description="Take a picture of a menu or price list, or choose a PDF. Galla reads the items and prices, you check them, and they are added." />
      <MenuImport enabled={!!env.ANTHROPIC_API_KEY} />
    </PageBody>
  );
}
