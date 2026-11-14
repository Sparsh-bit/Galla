import { ArrowRight, Check, Mail, MessageCircle, Minus, Phone, AtSign } from "lucide-react";
import { CONTACT } from "@/lib/concilio";


const NAVY = "text-[#032048]";
const EYEBROW = "font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#047348]";
const H2 = "mt-4 text-balance text-3xl font-extrabold tracking-[-0.045em] text-[#032048] sm:text-5xl";

const STATS = [
  { n: "18", label: "Modules in one app" },
  { n: "4", label: "Staff roles, each with their own access" },
  { n: "0", label: "Bills lost when the internet drops" },
  { n: "1", label: "App for phone, tablet or PC" },
];

export function Stats() {
  return (
    <section aria-label="Galla at a glance" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="reveal bg-card p-6 text-center sm:p-8">
            <p className="font-[Georgia,serif] text-5xl font-semibold italic text-[#047348] tabular-nums">{s.n}</p>
            <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const TODAY = ["Cash box and notebook disagree at closing", "Stock runs out, expired goods stay on the shelf", "Udhaar forgotten, GST a monthly scramble"];
const WITH = ["Every rupee and every item matched", "Low-stock and expiry alerts before it's too late", "Khata and GST done as you bill"];

export function BeforeAfter() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="reveal mx-auto max-w-2xl text-center">
        <p className={EYEBROW}>The problem</p>
        <h2 className={H2}>The cash box and the notebook <span className="serif-accent">never match.</span></h2>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="reveal rounded-3xl border border-border bg-muted/40 p-7">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</p>
          <ul className="mt-4 space-y-3">{TODAY.map((t) => <li key={t} className="flex gap-2.5 text-sm"><Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{t}</li>)}</ul>
        </div>
        <div className="reveal rounded-3xl border border-[#047348]/40 bg-gradient-to-br from-emerald-50 to-white p-7 shadow-[0_30px_70px_-50px_rgba(4,115,72,0.5)]">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#047348]">With Galla</p>
          <ul className="mt-4 space-y-3">{WITH.map((t) => <li key={t} className="flex gap-2.5 text-sm font-medium"><Check className="mt-0.5 size-4 shrink-0 text-[#047348]" />{t}</li>)}</ul>
          <p className="mt-5 text-sm text-muted-foreground">One app replaces the notebook, the calculator, the Excel sheet and the separate GST software.</p>
        </div>
      </div>
    </section>
  );
}

const SALE = [
  ["Scan", "Any scanner or the phone camera"],
  ["Bill", "GST picked for you, discounts, hold and recall"],
  ["Get paid", "UPI QR for the exact amount, cash, card or split"],
  ["Print or WhatsApp", "80 mm receipt, A4 invoice or a bill link on WhatsApp"],
  ["Works offline", "Syncs on its own when the signal returns"],
];

export function HowASaleWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="reveal mx-auto max-w-2xl text-center">
        <p className={EYEBROW}>How a sale works</p>
        <h2 className={H2}>Scan to WhatsApp in <span className="serif-accent">under a minute.</span></h2>
      </div>
      <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SALE.map(([t, d], i) => (
          <li key={t} data-delay={i * 80} className="reveal relative rounded-2xl border border-border bg-card p-5">
            <span className="grid size-8 place-items-center rounded-full bg-[#032048] font-mono text-sm font-bold text-white">{i + 1}</span>
            <h3 className={`mt-4 text-base font-bold ${NAVY}`}>{t}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-center text-sm text-muted-foreground">No special hardware needed: any USB or Bluetooth scanner and any 58/80 mm thermal printer works.</p>
    </section>
  );
}

const MODULES: [string, string[]][] = [
  ["Selling", ["Point of sale", "Scanning", "Printing", "WhatsApp bills", "Offline POS", "Documents"]],
  ["Stock and buying", ["Products", "Inventory", "Serial / IMEI", "Purchasing", "Import from Excel"]],
  ["Money and tax", ["Customers", "Khata (udhaar)", "Tax engine", "GST e-invoice", "Reports"]],
  ["Control", ["Team and roles", "Security"]],
];

export function Modules() {
  return (
    <section id="modules" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="reveal mx-auto max-w-2xl text-center">
        <p className={EYEBROW}>All 18 modules</p>
        <h2 className={H2}>Everything is built <span className="serif-accent">and tested.</span></h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">Grouped the way the counter works.</p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map(([group, items], i) => (
          <div key={group} data-delay={i * 90} className="reveal hover-lift rounded-2xl border border-border bg-card p-6">
            <h3 className={`text-base font-bold ${NAVY}`}>{group}</h3>
            <ul className="mt-4 space-y-2 text-sm">{items.map((m) => <li key={m} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#047348]" />{m}</li>)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const ROLES = ["Owner", "Manager", "Cashier", "Stock keeper"] as const;
const WHO: [string, boolean[]][] = [
  ["Billing, customers, collect dues", [true, true, true, false]],
  ["Returns, voids, discounts above 10%", [true, true, false, false]],
  ["Products, stock, purchases", [true, true, false, true]],
  ["Reports, profit, audit log", [true, true, false, false]],
  ["Settings, tax, team", [true, false, false, false]],
];
const TRUST = [
  ["Gap-free bill numbers", "One series per financial year."],
  ["No overselling", "Two tills, one IMEI: only one wins."],
  ["Nothing deleted", "Udhaar mistakes are reversed with a reason."],
  ["Your shop's data stays separate", "Two-step login and a full audit log."],
];

export function RolesAndTrust() {
  return (
    <section id="trust" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="reveal mx-auto max-w-2xl text-center">
        <p className={EYEBROW}>Roles and trust</p>
        <h2 className={H2}>Everyone sees only <span className="serif-accent">what they should.</span></h2>
      </div>
      <div className="mt-12 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="reveal overflow-hidden rounded-3xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead><tr className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground"><th scope="col" className="px-6 py-3 text-left font-semibold">Who can do what</th>{ROLES.map((r) => <th key={r} scope="col" className="px-3 py-3 text-center font-semibold">{r}</th>)}</tr></thead>
              <tbody>
                {WHO.map(([what, allowed]) => (
                  <tr key={what} className="border-t border-border/70">
                    <th scope="row" className="px-6 py-3 text-left font-medium">{what}</th>
                    {allowed.map((a, i) => <td key={i} className="px-3 py-3 text-center">{a ? <Check className="mx-auto size-4 text-[#047348]" aria-label="Allowed" /> : <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Not allowed" />}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {TRUST.map(([t, d]) => (
            <li key={t} className="reveal rounded-2xl border border-border bg-card p-5"><strong className={`block text-sm ${NAVY}`}>{t}</strong><span className="text-sm text-muted-foreground">{d}</span></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [
  ["Day 0", "Free demo", "On your phone, with your own products."],
  ["Day 1", "Setup", "We create your shop and import products, customers and old dues from Excel."],
  ["Day 2", "Train and go live", "Your staff learn on the real counter."],
  ["Every day after", "We stay on call", "WhatsApp and phone support, Monday to Saturday."],
];
const PROMISES = [
  ["Human reply in 12 hours", "An engineer, not a bot."],
  ["Your data is yours", "Export to Excel any time."],
  ["Free updates", "New features at no extra cost."],
  ["Price lock", "Your yearly price is fixed for 12 months."],
];

export function GettingStarted() {
  return (
    <section id="start" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="reveal mx-auto max-w-2xl text-center">
        <p className={EYEBROW}>Getting started</p>
        <h2 className={H2}>Billing on <span className="serif-accent">day two.</span></h2>
      </div>
      <ol className="mt-12 grid gap-3 md:grid-cols-4">
        {STEPS.map(([day, t, d], i) => (
          <li key={t} data-delay={i * 80} className="reveal rounded-2xl border border-border bg-card p-6">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#047348]">{day}</p>
            <h3 className={`mt-2 text-base font-bold ${NAVY}`}>{t}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PROMISES.map(([t, d]) => (
          <li key={t} className="reveal flex gap-3 rounded-2xl bg-[#032048] p-5 text-white">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            <span><strong className="block text-sm">{t}</strong><span className="text-sm text-white/70">{d}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Final call to action with every way to reach Concilio Solutions. */
export function ContactCta({ requestAccessUrl }: { requestAccessUrl: string }) {
  const items = [
    { icon: Mail, label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
    { icon: Phone, label: "Call or WhatsApp", value: CONTACT.phone, href: CONTACT.whatsapp },
    { icon: MessageCircle, label: "Website", value: "concilio.solutions", href: CONTACT.site },
    { icon: AtSign, label: "Instagram", value: CONTACT.instagramHandle, href: CONTACT.instagram },
  ];
  return (
    <div className="mt-10 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
      {items.map((c) => (
        <a key={c.label} href={c.href} target={c.href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer" className="hover-lift flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-[#047348]"><c.icon className="size-4" /></span>
          <span className="min-w-0"><span className="block text-xs text-muted-foreground">{c.label}</span><span className="block truncate text-sm font-semibold text-[#032048]">{c.value}</span></span>
        </a>
      ))}
      <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">Every enquiry gets a human reply within {CONTACT.replyWithin}. <a className="underline" href={requestAccessUrl} {...(requestAccessUrl.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>Book a free demo <ArrowRight className="inline size-3" /></a></p>
    </div>
  );
}

