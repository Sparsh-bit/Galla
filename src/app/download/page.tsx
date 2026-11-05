import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppDownloads } from "@/components/landing/app-downloads";
import { Logo, PoweredBy } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Download Galla", description: "Galla for Mac and Windows; iPhone, iPad and Android coming soon." };

export default function DownloadPage() {
  return (
    <div className="landing-page min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Galla home"><Logo className="text-2xl" /></Link>
          <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft /> Back</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brand-deep">Get the apps</p>
        <h1 className="mt-3 text-balance text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">Galla on <span className="serif-accent">every screen.</span></h1>
        <p className="mt-4 max-w-xl text-muted-foreground">The same shop, bills and stock on your counter PC, laptop and phone. Desktop apps print silently to any installed printer and keep billing offline.</p>

        <div className="mt-12"><AppDownloads /></div>
      </main>
      <footer className="border-t border-border/70"><div className="mx-auto flex max-w-5xl justify-center px-4 py-8"><PoweredBy /></div></footer>
    </div>
  );
}
