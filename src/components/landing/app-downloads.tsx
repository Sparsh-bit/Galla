import { Download, Monitor, Smartphone } from "lucide-react";
import { AndroidLogo, AppleLogo, WindowsLogo } from "./brand-icons";
import { env } from "@/env";
import { ANDROID_APK, DESKTOP, publishedInstallers } from "@/lib/downloads";

const MOBILE = [
  { name: "iPhone & iPad", icon: AppleLogo, store: "App Store", url: () => env.IOS_APP_URL },
  { name: ANDROID_APK.label, icon: AndroidLogo, store: "Google Play", url: () => env.ANDROID_APP_URL },
] as const;

/** Mac/Windows installers and mobile app downloads (direct APK or store link when available). */
export async function AppDownloads() {
  const { version, links } = await publishedInstallers(env.DESKTOP_RELEASE_BASE);
  return (
    <div className="space-y-10">
      <section aria-labelledby="dl-desktop">
        <h3 id="dl-desktop" className="flex items-center gap-2 text-lg font-bold text-[#032048]"><Monitor className="size-5 text-[#047348]" /> Desktop</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {DESKTOP.map((d) => {
            const href = links[d.id];
            const text = (
              <span className="flex items-start gap-3">
                {d.id === "windows" ? <WindowsLogo className="mt-0.5 size-6 shrink-0 text-[#0078d4]" /> : <AppleLogo className="mt-0.5 size-6 shrink-0 text-foreground" />}
                <span>
                <span className="block text-base font-bold text-[#032048]">{d.label}</span>
                <span className="text-xs text-muted-foreground">{d.sub}</span>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground/80">{href ? `${d.file}${version ? ` · v${version}` : ""}` : "Available soon"}</span>
                </span>
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
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#047348]">Soon</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          First time on a Mac: right-click Galla and choose Open. On Windows choose More info, then Run anyway. Installed apps update themselves.
        </p>
      </section>

      <section aria-labelledby="dl-mobile">
        <h3 id="dl-mobile" className="flex items-center gap-2 text-lg font-bold text-[#032048]"><Smartphone className="size-5 text-[#047348]" /> Phone & tablet</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MOBILE.map((m) => {
            const storeUrl = m.url();
            const isAndroid = m.name === ANDROID_APK.label;
            const apkUrl = isAndroid ? links[ANDROID_APK.id] : undefined;
            const releaseUrl = isAndroid ? links[`${ANDROID_APK.id}Page`] : undefined;
            const href = storeUrl || apkUrl || releaseUrl;
            const sub = storeUrl
              ? `Get it on ${m.store}`
              : apkUrl
                ? `Download APK${version ? ` · v${version}` : ""} (direct install)`
                : releaseUrl
                  ? `Download APK${version ? ` · v${version}` : ""} from latest release`
                  : `On the ${m.store} soon`;
            const body = (
              <span className="flex w-full items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-[#047348]"><m.icon className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-base font-bold text-[#032048]">{m.name}</span><span className="text-xs text-muted-foreground">{sub}</span></span>
                {href && !storeUrl && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Download className="size-4" /></span>}
                {!href && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#047348]">Coming soon</span>}
              </span>
            );
            return href ? (
              <a key={m.name} href={href} {...(apkUrl ? { download: true } : {})} target={storeUrl || releaseUrl ? "_blank" : undefined} rel={storeUrl || releaseUrl ? "noopener noreferrer" : undefined} className="hover-lift flex rounded-2xl border border-border bg-card p-5">{body}</a>
            ) : (
              <div key={m.name} aria-disabled="true" className="flex rounded-2xl border border-dashed border-border bg-card/60 p-5">{body}</div>
            );
          })}
        </div>
        {(links[ANDROID_APK.id] || links[`${ANDROID_APK.id}Page`]) && (
          <p className="mt-3 text-xs text-muted-foreground">Android: download and open the APK, then allow install from this source if asked. Installed apps can check for updates automatically once an APK release is available.</p>
        )}

      </section>
    </div>
  );
}
