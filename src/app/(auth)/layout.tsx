import Link from "next/link";
import { Barcode, Printer, ShieldCheck, Smartphone } from "lucide-react";
import { Logo, PoweredBy } from "@/components/app/logo";
import { LanguagePicker } from "@/components/app/i18n-provider";

const POINTS = [
  { icon: Barcode, title: "Scan anything", text: "USB and Bluetooth scanners, or just your phone camera." },
  { icon: Printer, title: "Print receipts", text: "58/80mm thermal printers, A4 GST invoices and barcode labels." },
  { icon: Smartphone, title: "Works everywhere", text: "Desktop, tablet or phone. Install it like an app, even offline." },
  { icon: ShieldCheck, title: "Secure by default", text: "Two-factor login, roles and a full audit trail." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-gradient-to-br from-[#f4f8fc] via-[#edf4fb] to-[#e7f4ed] text-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="hero-orb hero-orb-one" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.25] [background-image:radial-gradient(circle_at_1px_1px,oklch(0.49_0.12_158/.35)_1px,transparent_0)] [background-size:22px_22px]" />
        <Link href="/" className="relative" aria-label="Galla home">
          <Logo className="text-3xl" />
        </Link>
        <div className="relative max-w-md space-y-8">
          <h2 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.045em] text-[#032048]">
            Your shop’s <span className="serif-accent">digital cash box.</span>
          </h2>
          <ul className="space-y-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/90 text-[#047348] shadow-sm ring-1 ring-emerald-600/10">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block font-semibold text-[#032048]">{title}</span>
                  <span className="text-sm text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center justify-between gap-4">
          <PoweredBy />
          <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} Galla</span>
        </div>
      </aside>
      <main className="relative flex flex-col justify-center px-4 py-10 sm:px-10">
        <LanguagePicker className="absolute right-4 top-4" />
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          {children}
          <div className="mt-10 flex justify-center lg:hidden"><PoweredBy /></div>
        </div>
      </main>
    </div>
  );
}
