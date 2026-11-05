import "server-only";

/**
 * Installers are published as assets of the latest release of a public, releases-only repository
 * (no source code in it), with these exact file names. The code repositories stay private.
 */
const RELEASES_REPO = "Sparsh-bit/galla-releases";
const LATEST_API = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;

export interface DownloadItem { id: "mac-arm" | "mac-intel" | "windows"; label: string; sub: string; file: string }

export const DESKTOP: DownloadItem[] = [
  { id: "mac-arm", label: "macOS", sub: "Apple silicon (M1 and newer)", file: "Galla-mac-arm64.dmg" },
  { id: "mac-intel", label: "macOS", sub: "Intel", file: "Galla-mac-x64.dmg" },
  { id: "windows", label: "Windows", sub: "Windows 10 and 11, 64-bit", file: "Galla-win-x64.exe" },
];

/**
 * Direct download links for the installers that are actually published, so a button never sends
 * people to an empty GitHub page. With DESKTOP_RELEASE_BASE set (own file host) every file is assumed present.
 * Cached for 10 minutes to stay far below GitHub's anonymous API limit.
 */
export async function publishedInstallers(base?: string): Promise<{ version: string | null; links: Record<string, string> }> {
  if (base) return { version: null, links: Object.fromEntries(DESKTOP.map((d) => [d.file, `${base.replace(/\/$/, "")}/${d.file}`])) };
  try {
    const res = await fetch(LATEST_API, { headers: { Accept: "application/vnd.github+json" }, next: { revalidate: 600 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { version: null, links: {} };
    const rel = (await res.json()) as { tag_name?: string; assets?: { name: string; browser_download_url: string }[] };
    return { version: rel.tag_name?.replace(/^desktop-v|^v/, "") ?? null, links: Object.fromEntries((rel.assets ?? []).map((a) => [a.name, a.browser_download_url])) };
  } catch {
    return { version: null, links: {} };
  }
}

/** Placeholder until the Concilio Solutions booking page is ready; override with REQUEST_ACCESS_URL. */
export const DEFAULT_REQUEST_ACCESS_URL = "https://concilio.solutions";
