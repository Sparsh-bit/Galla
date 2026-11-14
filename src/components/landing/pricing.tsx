import { Check, Minus } from "lucide-react";
import { ADDONS, COMPARE, PLANS, rupees } from "@/lib/concilio";
import { Button } from "@/components/ui/button";

/**
 * Plans and prices. There is no checkout on purpose: a visitor requests access, Concilio Solutions sets
 * the shop up and sends the username and password, and invoices directly.
 */
export function Pricing({ requestAccessUrl }: { requestAccessUrl: string }) {
  return (
    <section id="pricing" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="reveal mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#047348]">Pricing</p>
        <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-[-0.045em] text-[#032048] sm:text-5xl">Simple plans. <span className="serif-accent">Per shop.</span></h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">Every plan includes free updates, WhatsApp bills, GST invoices and phone support. Prices are per shop, before 18% GST.</p>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {PLANS.map((p, i) => (
          <article key={p.id} data-delay={i * 90} className={`reveal relative flex flex-col rounded-3xl border bg-card p-7 ${p.popular ? "border-[#047348] shadow-[0_30px_70px_-40px_rgba(4,115,72,0.55)] ring-1 ring-[#047348]/40" : "border-border"}`}>
            {p.popular && <span className="absolute -top-3 left-7 rounded-full bg-[#047348] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">Most popular</span>}
            <h3 className="text-xl font-extrabold tracking-tight text-[#032048]">{p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
            <p className="mt-6 flex items-baseline gap-1.5"><span className="text-4xl font-extrabold tracking-tight text-[#032048] tabular-nums">{rupees(p.monthly)}</span><span className="text-sm text-muted-foreground">/ month</span></p>
            <p className="mt-1 text-sm text-muted-foreground">or <strong className="text-foreground">{rupees(p.yearly)} / year</strong>, 2 months free</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-[#047348]" /><span>{f}</span></li>
              ))}
            </ul>
            <Button asChild size="lg" variant={p.popular ? "default" : "outline"} className="mt-8 h-11 rounded-full font-semibold">
              <a href={requestAccessUrl} target="_blank" rel="noopener noreferrer">Request access</a>
            </Button>
          </article>
        ))}
      </div>

      <div className="reveal mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <h3 className="text-lg font-bold text-[#032048]">How it works: no payment on this site</h3>
        <ol className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          {[["Request access", "Tell us about your shop. An engineer replies within 12 hours and shows you Galla live with your own products."], ["We set you up", "We create your shop and send you the username and password for the app, and import your products, customers and old dues from Excel."], ["Pay us directly", "We send a GST invoice. Pay by UPI, bank transfer, card or cheque, monthly or yearly. Cancel with 30 days' notice."]].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#032048] font-mono text-xs font-bold text-white">{i + 1}</span>
              <span><strong className="block text-[#032048]">{t}</strong><span className="text-muted-foreground">{d}</span></span>
            </li>
          ))}
        </ol>
      </div>

      <div className="reveal mt-6 overflow-hidden rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4 sm:px-8"><h3 className="text-lg font-bold text-[#032048]">Compare plans</h3><p className="text-sm text-muted-foreground">Pick by counters and shops.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-6 py-3 font-semibold sm:px-8">Feature</th>
                {PLANS.map((p) => <th key={p.id} scope="col" className="px-4 py-3 text-center font-semibold">{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.feature} className="border-t border-border/70">
                  <th scope="row" className="px-6 py-3 text-left font-medium sm:px-8">{r.feature}</th>
                  {r.values.map((v, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      {v === true ? <Check className="mx-auto size-4 text-[#047348]" aria-label="Included" /> : v === false ? <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Not included" /> : <span className="font-semibold tabular-nums">{v}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="reveal mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ADDONS.map((a) => (
          <div key={a.name} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{a.name}</p>
            <p className="mt-1 text-lg font-extrabold text-[#032048]">{a.price}</p>
            {a.note && <p className="mt-1 text-xs leading-5 text-muted-foreground">{a.note}</p>}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">All prices are per shop and exclude 18% GST. Yearly prices are locked for 12 months. No-cost EMI (3 or 6 months) on major credit cards, subject to your bank&apos;s approval.</p>
    </section>
  );
}
