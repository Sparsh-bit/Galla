import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Galla by Concilio — Modern Shop POS, Billing & Inventory",
    short_name: "Galla",
    description: "Billing, stock, khata and GST in one app. Powered by Concilio Solutions.",
    start_url: "/pos",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#032048",
    orientation: "any",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "New sale", url: "/pos" },
      { name: "Products", url: "/products" },
    ],
  };
}
