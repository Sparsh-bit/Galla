import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Galla — Your shop’s digital cash box",
    short_name: "Galla",
    description: "Billing, stock, khata and GST in one app. Powered by Concilio Solutions.",
    start_url: "/pos",
    display: "standalone",
    background_color: "#fbf7ef",
    theme_color: "#f5a524",
    orientation: "any",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New sale", url: "/pos" },
      { name: "Products", url: "/products" },
    ],
  };
}
