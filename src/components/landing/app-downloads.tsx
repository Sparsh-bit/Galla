import { Apple, Download, Monitor, Smartphone } from "lucide-react";
import { env } from "@/env";
import { DESKTOP, publishedInstallers } from "@/lib/downloads";

const MOBILE = [
  { name: "iPhone & iPad", icon: Apple, store: "App Store", url: () => env.IOS_APP_URL },
  { name: "Android", icon: Smartphone, store: "Google Play", url: () => env.ANDROID_APP_URL },
];

/** Mac and Windows installers, plus the phone apps (coming soon until their store links are set). */
export async function AppDownloads() {
  const { version, links } = await publishedInstallers(env.DESKTOP_RELEASE_BASE);
  return (
    <div className="space-y-10">
      <section aria-labelledby="dl-desktop">
        <h3 id="dl-desktop" className="flex items-center gap-2 text-lg font-bold"><Monitor className="size-5 text-brand-deep" /> Desktop</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {DESKTOP.map((d) => {
            const href = links[d.file];
            const text = (
              <span>
                <span className="block text-base font-bold">{d.label}</span>
                <span className="text-xs text-muted-foreground">{d.sub}</span>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground/80">{href ? `${d.file}${version ? ` · v${version}` : ""}` : "Available soon"}</span>
              </span>
            );
            return href ? (
              <a key={d.id} href={href} download className="hover-lift group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
                {text}
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:translate-y-0.5"><Download className="size-4" /></span>
              </a>
            ) : (
              <div key={d.id} aria-disabled="true" className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-5">
                {text}
                <span className="rounded-full bg-primary/15 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-deep">Soon</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          First time on a Mac: right-click Galla and choose Open. On Windows choose More info, then Run anyway. Installed apps update themselves.
        </p>
      </section>

      <section aria-labelledby="dl-mobile">
        <h3 id="dl-mobile" className="flex items-center gap-2 text-lg font-bold"><Smartphone className="size-5 text-brand-deep" /> Phone & tablet</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MOBILE.map((m) => {
            const url = m.url();
            const body = (
              <span className="flex w-full items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-brand-deep"><m.icon className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-base font-bold">{m.name}</span><span className="text-xs text-muted-foreground">{url ? `Get it on ${m.store}` : `On the ${m.store} soon`}</span></span>
                {!url && <span className="rounded-full bg-primary/15 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-deep">Coming soon</span>}
              </span>
            );
            return url ? (
              <a key={m.name} href={url} className="hover-lift flex rounded-2xl border border-border bg-card p-5">{body}</a>
            ) : (
              <div key={m.name} aria-disabled="true" className="flex rounded-2xl border border-dashed border-border bg-card/60 p-5">{body}</div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
