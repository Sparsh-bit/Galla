import type { Metadata } from "next";
import Link from "next/link";
import { Apple, ArrowLeft, Download, Monitor, Smartphone } from "lucide-react";
import { env } from "@/env";
import { DESKTOP, RELEASES, releaseUrl } from "@/lib/downloads";
import { Logo, PoweredBy } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Download Galla", description: "Galla for Mac, Windows, iPhone, iPad and Android." };

export default function DownloadPage() {
  const mobile = [
    { name: "iPhone & iPad", icon: Apple, url: env.IOS_APP_URL, store: "App Store" },
    { name: "Android", icon: Smartphone, url: env.ANDROID_APP_URL, store: "Google Play" },
  ];
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
        <p className="mt-4 max-w-xl text-muted-foreground">The same shop, bills and stock on your counter PC, laptop and phone. Desktop apps print silently to any installed printer and work offline.</p>

        <section aria-labelledby="desktop" className="mt-12">
          <h2 id="desktop" className="flex items-center gap-2 text-lg font-bold"><Monitor className="size-5 text-brand-deep" /> Desktop</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {DESKTOP.map((d) => (
              <a key={d.id} href={releaseUrl(env.DESKTOP_RELEASE_BASE, d.file)} className="hover-lift group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
                <span><span className="block text-base font-bold">{d.label}</span><span className="text-xs text-muted-foreground">{d.sub}</span></span>
                <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:translate-y-0.5"><Download className="size-4" /></span>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">First time on a Mac: right-click the app, choose Open. On Windows choose More info, then Run anyway, until signed installers are published. All versions: <a className="underline" href={RELEASES}>releases</a>.</p>
        </section>

        <section aria-labelledby="mobile" className="mt-12">
          <h2 id="mobile" className="flex items-center gap-2 text-lg font-bold"><Smartphone className="size-5 text-brand-deep" /> Phone & tablet</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {mobile.map((m) => {
              const body = (
                <>
                  <span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-brand-deep"><m.icon className="size-5" /></span><span><span className="block text-base font-bold">{m.name}</span><span className="text-xs text-muted-foreground">{m.url ? `Get it on ${m.store}` : `Coming soon to ${m.store}. Until then open Galla in your browser and choose Add to Home Screen.`}</span></span></span>
                </>
              );
              return m.url ? <a key={m.name} href={m.url} className="hover-lift flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">{body}</a> : <div key={m.name} className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-5">{body}</div>;
            })}
          </div>
        </section>
      </main>
      <footer className="border-t border-border/70"><div className="mx-auto flex max-w-5xl justify-center px-4 py-8"><PoweredBy /></div></footer>
    </div>
  );
}
