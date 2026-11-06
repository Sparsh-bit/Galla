import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { env } from "@/env";
import { Logo, PoweredBy } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

/** Plain public page for policies (privacy, account deletion): readable without signing in. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="landing-page min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Galla home"><Logo className="text-2xl" /></Link>
          <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft /> Back</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-7 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_a]:underline">{children}</div>
      </main>
      <footer className="border-t border-border/70"><div className="mx-auto flex max-w-3xl justify-center px-4 py-8"><PoweredBy /></div></footer>
    </div>
  );
}

/** How to reach whoever runs this Galla server about privacy. */
export function PrivacyContact() {
  return env.SUPPORT_EMAIL ? <a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a> : <a href="https://concilio.solutions">concilio.solutions</a>;
}
