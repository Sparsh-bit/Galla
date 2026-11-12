import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import { NativeShell } from "@/components/app/native-shell";
import { LITE_SCRIPT, SPLASH_SCRIPT, THEME_SCRIPT } from "@/lib/boot-scripts";
import { WelcomeSplash } from "@/components/app/welcome-splash";
import { I18nProvider } from "@/components/app/i18n-provider";
import { getLang } from "@/server/i18n";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const serif = Newsreader({ variable: "--font-serif", subsets: ["latin"], style: ["italic"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Galla by Concilio — Modern Shop POS, Billing & Inventory", template: "%s · Galla" },
  description: "Billing, stock, khata and GST in one app, built for Indian shops. Works with barcode scanners, receipt printers, your phone camera, and offline. Powered by Concilio Solutions.",
  applicationName: "Galla",
  authors: [{ name: "Concilio Solutions", url: "https://concilio.solutions" }],
  creator: "Concilio Solutions",
  appleWebApp: { capable: true, title: "Galla", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#050e1c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const lang = await getLang();
  return (
    <html lang={lang} suppressHydrationWarning className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background">
        <Script id="theme" strategy="beforeInteractive" nonce={nonce}>
          {THEME_SCRIPT + LITE_SCRIPT + SPLASH_SCRIPT}
        </Script>
        <NativeShell />
        <WelcomeSplash />
        <I18nProvider lang={lang}>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </I18nProvider>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
