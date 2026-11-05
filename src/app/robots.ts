import type { MetadataRoute } from "next";

/** Only the public landing and download pages belong in search results; the app itself is private. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: ["/", "/download"], disallow: ["/api/", "/dashboard", "/pos", "/sales", "/settings", "/bill/", "/print/", "/scan/", "/accept-invite/"] }] };
}
