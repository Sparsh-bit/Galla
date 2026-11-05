import type { CapacitorConfig } from "@capacitor/cli";

// The app is a native shell around your Galla server, so web updates reach phones instantly.
// Set GALLA_URL to your https address before `npx cap sync` (use http://<your-mac-ip>:3000 for local testing).
const url = process.env.GALLA_URL;

const config: CapacitorConfig = {
  appId: "app.galla.mobile",
  appName: "Galla",
  webDir: "www",
  backgroundColor: "#fbf7ef",
  ios: { contentInset: "never", scrollEnabled: true, limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false },
  server: url ? { url, cleartext: url.startsWith("http://"), allowNavigation: [new URL(url).host] } : undefined,
  plugins: {
    SplashScreen: { launchShowDuration: 900, backgroundColor: "#fbf7ef", showSpinner: false, launchAutoHide: true },
    StatusBar: { style: "LIGHT", backgroundColor: "#fbf7ef" },
    Keyboard: { resize: "native" },
  },
};

export default config;
