/** Installer links. Names match the CI workflow (desktop.yml) so a release makes the buttons work. */
export const RELEASES = "https://github.com/Sparsh-bit/Inventory/releases";

export interface DownloadItem { id: "mac-arm" | "mac-intel" | "windows"; label: string; sub: string; file: string }

export const DESKTOP: DownloadItem[] = [
  { id: "mac-arm", label: "macOS", sub: "Apple silicon (M1 and newer)", file: "Galla-mac-arm64.dmg" },
  { id: "mac-intel", label: "macOS", sub: "Intel", file: "Galla-mac-x64.dmg" },
  { id: "windows", label: "Windows", sub: "Windows 10 and 11, 64-bit", file: "Galla-win-x64.exe" },
];

export const releaseUrl = (base: string | undefined, file: string) => `${(base || `${RELEASES}/latest/download`).replace(/\/$/, "")}/${file}`;

/** Placeholder until the Concilio Solutions booking page is ready; override with REQUEST_ACCESS_URL. */
export const DEFAULT_REQUEST_ACCESS_URL = "https://concilio.solutions";
