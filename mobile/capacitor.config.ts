import type { CapacitorConfig } from "@capacitor/cli";

// The app is a native shell around your Galla server: the same backend and database as the website and the
// desktop apps, and every web deploy reaches phones instantly without a new App Store build.
// Set GALLA_URL to your https address before `npx cap sync` (use http://<your-mac-ip>:3000 for local testing).
const url = process.env.GALLA_URL;

const config: CapacitorConfig = {
  appId: "app.galla.mobile",
  appName: "Galla",
  webDir: "www",
  backgroundColor: "#fbf7ef",
  ios: { contentInset: "never", scrollEnabled: true, limitsNavigationsToAppBoundDomains: false },
  server: url ? { url, cleartext: url.startsWith("http://"), allowNavigation: [new URL(url).host] } : undefined,
  plugins: {
    SplashScreen: { launchShowDuration: 900, backgroundColor: "#fbf7ef", showSpinner: false, launchAutoHide: true },
    StatusBar: { style: "LIGHT", backgroundColor: "#fbf7ef" },
    Keyboard: { resize: "native" },
  },
};

export default config;
