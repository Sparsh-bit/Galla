import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookUser, Boxes, Check, FileText, Printer, ReceiptText, ScanLine, ShieldCheck, Smartphone, Store, Users, WifiOff } from "lucide-react";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Logo, PoweredBy } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { LandingMotion } from "@/components/landing/landing-motion";

export const metadata: Metadata = {
  title: "Galla — Your shop’s digital cash box",
  description: "Billing, stock, khata and GST in one app, built for Indian shops. Powered by Concilio Solutions.",
};

const PAINS = ["Stock-outs nobody saw", "Udhaar lost in notebooks", "Slow counters", "Expired goods on shelves", "No internet, no billing", "GST is a monthly scramble"];

const FEATURES = [
  { icon: ScanLine, title: "Scan. Bill. Done.", text: "Scan-to-bill or search, hold and recall bills, split payments and a UPI QR for the exact amount." },
  { icon: Printer, title: "Works with the hardware you have", text: "USB or Bluetooth scanners, phone camera, 58/80 mm thermal, A4 GST invoices and any installed printer." },
  { icon: WifiOff, title: "Internet gone? Billing isn’t.", text: "The POS opens from cache, keeps GST-compliant bill numbers and syncs when you are back online." },
  { icon: BookUser, title: "Udhaar, without the notebook", text: "Running balance per person, WhatsApp reminders and nothing ever deleted: mistakes are reversed with a reason." },
  { icon: Boxes, title: "Know before it runs out", text: "Shops and godowns, batches and expiry, low-stock alerts, transfers and scan-to-count stock takes." },
  { icon: Smartphone, title: "Every IMEI. Every purchase.", text: "Serial tracking from purchase to sale and return, with warranty lookup and bill photos." },
  { icon: FileText, title: "GST, done right", text: "CGST/SGST or IGST picked for you, e-invoice with IRN + QR, e-way bill and GSTR-1 ready reports." },
  { icon: Users, title: "The right access for every hand", text: "Owner, Manager, Cashier and Stock keeper roles, email invites, audit log and two-step login." },
];

const COUNTERS = ["Kirana & supermarket", "Pharmacy", "Mobile & electronics", "Hardware", "Garments & footwear", "Distributors", "Cosmetics & stationery", "Bakery", "Multi-branch shops"];

export default async function HomePage() {
  if (await auth.api.getSession({ headers: await headers() })) redirect("/dashboard");

  return (
    <div className="landing-page min-h-dvh overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Galla home" className="rounded-lg"><Logo className="text-2xl" /></Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#offline" className="transition-colors hover:text-foreground">Offline</a>
            <a href="#counters" className="transition-colors hover:text-foreground">Who it’s for</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/sign-in">Sign in</Link></Button>
            <Button asChild size="sm" className="rounded-full px-4 font-semibold"><Link href="/sign-up">Get started <ArrowRight className="ml-1 size-4" /></Link></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero relative isolate">
          <div className="hero-orb hero-orb-one" aria-hidden="true" />
          <div className="hero-orb hero-orb-two" aria-hidden="true" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:grid-cols-[1fr_0.95fr] lg:gap-12">
            <div className="landing-copy relative z-10 max-w-2xl">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-white/80 px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-brand-deep shadow-sm">
                <span className="size-1.5 rounded-full bg-primary" /> Billing · Stock · Khata · GST
              </p>
              <h1 className="text-balance text-[2.9rem] font-extrabold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-[4.6rem]">
                Your shop’s <span className="serif-accent font-medium tracking-[-0.03em]">digital cash box.</span>
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Galla runs the whole counter: selling, stock, credit and tax, on the devices your shop already owns. One app instead of four habits.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-12 rounded-full px-6 text-sm font-semibold shadow-lg shadow-primary/30"><Link href="/sign-up">Create your shop <ArrowRight className="ml-1 size-4" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-full bg-white/70 px-6"><Link href="/sign-in">Sign in</Link></Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
                {["USB, Bluetooth & camera scanning", "Any printer", "Works offline"].map((l) => <span key={l} className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" />{l}</span>)}
              </div>
            </div>

            <div className="landing-preview relative mx-auto w-full max-w-[560px] lg:mr-0">
              <div className="preview-halo" aria-hidden="true" />
              <div className="relative z-10 overflow-hidden rounded-[1.6rem] border border-white bg-white p-3 shadow-[0_30px_90px_-35px_rgba(120,70,10,0.35)]">
                <div className="flex h-9 items-center justify-between px-2 text-[10px] text-slate-400">
                  <span className="flex gap-1.5"><i className="size-2 rounded-full bg-[#f2c879]" /><i className="size-2 rounded-full bg-[#e8a77a]" /><i className="size-2 rounded-full bg-[#d6d9e2]" /></span>
                  <span>galla · Point of sale</span>
                  <span className="font-mono">F2 search · F4 pay</span>
                </div>
                <div className="relative rounded-2xl border border-slate-100 bg-[#fcfaf6] p-4">
                  <span className="scan-line" aria-hidden="true" />
                  <p className="mb-3 flex items-center gap-2 font-mono text-[10px] text-slate-400"><ScanLine className="size-3.5 text-primary" /> 8904043901015</p>
                  {[["Aashirvaad Atta 5kg", "1 × ₹285", "₹285"], ["Amul Butter 500g", "2 × ₹275", "₹550"], ["Tata Salt 1kg", "3 × ₹28", "₹84"], ["Maggi Noodles 12-pack", "1 × ₹495", "₹495"]].map(([n, q, t]) => (
                    <div key={n} className="flex items-center justify-between border-b border-slate-100 py-2.5 text-xs last:border-0">
                      <span className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-lg bg-amber-100 text-amber-700"><Store className="size-3.5" /></span><span className="font-medium text-slate-800">{n}</span></span>
                      <span className="flex items-center gap-4 tabular-nums"><span className="text-slate-400">{q}</span><span className="w-12 text-right font-semibold text-slate-800">{t}</span></span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#14161f] px-5 py-4 text-white">
                  <div><p className="text-[10px] uppercase tracking-widest text-white/50">Total · 4 items</p><p className="text-2xl font-bold tabular-nums" data-count="1414" data-prefix="₹">₹1,414</p></div>
                  <span className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-[#2a1b05]">Pay <kbd className="ml-1 rounded bg-black/10 px-1 text-[10px]">F4</kbd></span>
                </div>
              </div>
              <div className="float-y absolute -bottom-5 -left-3 z-20 flex items-center gap-2.5 rounded-2xl border border-white bg-white p-3 shadow-xl shadow-amber-900/10 sm:-left-8">
                <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ReceiptText className="size-4" /></span>
                <span><strong className="block text-xs text-slate-800">Bill sent on WhatsApp</strong><span className="text-[11px] text-slate-500">with a secure link</span></span>
              </div>
              <div className="float-y absolute -right-2 -top-5 z-20 hidden items-center gap-2 rounded-2xl border border-white bg-white p-3 shadow-xl shadow-amber-900/10 [animation-delay:-2s] sm:flex">
                <span className="grid size-8 place-items-center rounded-xl bg-amber-50 text-amber-700"><ShieldCheck className="size-4" /></span>
                <span><strong className="block text-xs text-slate-800">UPI QR</strong><span className="text-[11px] text-slate-500">for the exact amount</span></span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-[#14161f] py-5 text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 text-xs font-medium text-white/70 sm:px-6">
            <span className="font-mono uppercase tracking-[0.18em] text-primary">The galla and the notebook never match</span>
            {PAINS.map((p) => <span key={p} className="inline-flex items-center gap-2"><span className="size-1 rounded-full bg-primary/70" />{p}</span>)}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brand-deep">Meet Galla</p>
            <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">One app instead of <span className="serif-accent">four habits.</span></h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">Notebook khata, calculator bills, Excel stock sheets and separate GST software, together in one calm workspace.</p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <article key={title} data-delay={(i % 4) * 90} className="reveal hover-lift feature-card group relative overflow-hidden rounded-2xl border border-border bg-card p-6">
                <div className="feature-glow" aria-hidden="true" />
                <span className="relative mb-5 grid size-11 place-items-center rounded-xl bg-primary/15 text-brand-deep"><Icon className="size-5" /></span>
                <h3 className="relative text-base font-bold tracking-tight">{title}</h3>
                <p className="relative mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="offline" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="workflow-panel reveal relative overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16">
            <div className="hero-orb hero-orb-one opacity-60" aria-hidden="true" />
            <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Offline billing</p>
                <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">Internet gone? <span className="font-[Georgia,serif] font-medium italic text-primary">Billing isn’t.</span></h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-white/70 sm:text-base">Most cloud tools freeze when the signal drops. Galla keeps selling and syncs the moment you are back.</p>
                <Button asChild size="lg" className="mt-8 h-12 rounded-full px-6 font-semibold"><Link href="/sign-up">Start billing <ArrowRight className="ml-1 size-4" /></Link></Button>
              </div>
              <ol className="space-y-3">
                {[["Register the till", "Open the POS once online: products, stock, serials and customers download."], ["Signal drops", "The POS opens from cache and finds everything locally."], ["Bills keep their number", "Each till has its own GST-compliant series."], ["Back online", "Auto-sync. Conflicts are flagged for review, never lost."]].map(([t, d], i) => (
                  <li key={t} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-mono text-sm font-bold text-[#2a1b05]">{i + 1}</span>
                    <span><strong className="block text-sm">{t}</strong><span className="text-sm text-white/65">{d}</span></span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="counters" className="scroll-mt-20 pb-20 sm:pb-28">
          <div className="reveal mx-auto max-w-2xl px-4 text-center">
            <h2 className="text-balance text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">Built for <span className="serif-accent">every counter.</span></h2>
          </div>
          <div className="marquee mt-10 overflow-hidden" aria-label="Kinds of shops Galla is built for">
            <div className="marquee-track">
              {[...COUNTERS, ...COUNTERS].map((c, i) => <span key={i} aria-hidden={i >= COUNTERS.length} className="whitespace-nowrap rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium shadow-sm">{c}</span>)}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="reveal mx-auto max-w-4xl rounded-[2rem] border border-primary/30 bg-gradient-to-br from-amber-50 to-white px-6 py-14 text-center shadow-[0_30px_80px_-50px_rgba(180,100,10,0.5)] sm:px-12">
            <Logo className="text-4xl" />
            <p className="mt-6 font-[Georgia,serif] text-2xl italic text-foreground sm:text-3xl">Har dukaan ka <span className="serif-accent not-italic">digital galla.</span></p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-7 font-semibold shadow-lg shadow-primary/30"><Link href="/sign-up">Create your shop <ArrowRight className="ml-1 size-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full bg-white px-6"><a href="https://concilio.solutions" target="_blank" rel="noopener noreferrer">Book a free demo</a></Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo className="text-xl" />
          <PoweredBy />
          <span>© {new Date().getFullYear()} Galla. Made for the people who keep business moving.</span>
        </div>
      </footer>
      <LandingMotion />
    </div>
  );
}
