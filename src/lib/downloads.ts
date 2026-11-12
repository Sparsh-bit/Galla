import "server-only";

/**
 * Installers are published as assets of the latest release of a public, releases-only repository
 * (no source code in it), with these exact file names. The code repositories stay private.
 */
const RELEASES_REPO = "Sparsh-bit/galla-releases";
const LATEST_API = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;

export interface DownloadItem { id: "mac-arm" | "mac-intel" | "windows" | "android"; label: string; sub: string; file?: string; filePattern?: RegExp }

export const DESKTOP: DownloadItem[] = [
  { id: "mac-arm", label: "macOS", sub: "Apple silicon (M1 and newer)", file: "Galla-mac-arm64.dmg" },
  { id: "mac-intel", label: "macOS", sub: "Intel", file: "Galla-mac-x64.dmg" },
  { id: "windows", label: "Windows", sub: "Windows 10 and 11, 64-bit", file: "Galla-win-x64.exe" },
];

export const ANDROID_APK: DownloadItem = {
  id: "android",
  label: "Android",
  sub: "Android phones and tablets (APK)",
  file: "Galla-android.apk",
  filePattern: /^galla.*\.apk$/i,
};

/**
 * Direct download links for the installers that are actually published, so a button never sends
 * people to an empty GitHub page. With DESKTOP_RELEASE_BASE set (own file host) fixed-name files
 * are assumed present. Cached for 10 minutes to stay far below GitHub's anonymous API limit.
 */
export async function publishedInstallers(base?: string): Promise<{ version: string | null; links: Record<string, string> }> {
  if (base) {
    const root = base.replace(/\/$/, "");
    return { version: null, links: Object.fromEntries(DESKTOP.map((d) => [d.file!, `${root}/${d.file}`])) };
  }
  try {
    const res = await fetch(LATEST_API, { headers: { Accept: "application/vnd.github+json" }, next: { revalidate: 600 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { version: null, links: {} };
    const rel = (await res.json()) as { tag_name?: string; html_url?: string; assets?: { name: string; browser_download_url: string }[] };
    const assets = rel.assets ?? [];
    const links: Record<string, string> = {};
    for (const d of DESKTOP) {
      const a = assets.find((x) => x.name === d.file);
      if (a) links[d.id] = a.browser_download_url;
    }
    const apk = assets.find((a) => a.name === ANDROID_APK.file) ?? assets.find((a) => ANDROID_APK.filePattern?.test(a.name));
    // Direct-download URL: browser starts download when the APK asset exists in the latest release.
    // Uses the canonical asset name so publishing `Galla-android.apk` (or matching name) makes it work automatically.
    const apkDownload = apk?.browser_download_url ?? `https://github.com/${RELEASES_REPO}/releases/latest/download/${ANDROID_APK.file}`;
    links[ANDROID_APK.id] = apkDownload;
    if (!apk && rel.html_url) links[`${ANDROID_APK.id}Page`] = rel.html_url;
    return { version: rel.tag_name?.replace(/^desktop-v|^v/, "") ?? null, links };
  } catch {
    // Fallback to canonical latest-download URL so the button can still trigger a direct APK download once published.
    return { version: null, links: { [ANDROID_APK.id]: `https://github.com/${RELEASES_REPO}/releases/latest/download/${ANDROID_APK.file}` } };
  }
}

/** Placeholder until the Concilio Solutions booking page is ready; override with REQUEST_ACCESS_URL. */
export const DEFAULT_REQUEST_ACCESS_URL = "https://concilio.solutions/book?service=galla";
