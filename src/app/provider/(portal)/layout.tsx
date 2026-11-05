import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { ProviderSignOut } from "@/components/provider/provider-sign-out";
import { requireProvider } from "@/server/services/provider";

export const metadata: Metadata = { title: { default: "Provider portal", template: "%s · Provider · Galla" }, robots: { index: false, follow: false } };

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const p = await requireProvider();
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/provider" className="flex items-center gap-2"><Logo className="text-xl" /><span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-brand-deep"><ShieldCheck className="size-3.5" /> Provider</span></Link>
          <Link href="/provider/account" className="ml-auto hidden text-sm text-muted-foreground hover:text-foreground sm:inline">{p.email}</Link>
          <ProviderSignOut />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
