/** A small copy of a product photo for lists (the server makes and keeps it). Other URLs are returned unchanged. */
export function thumb(url: string | null | undefined, w: 64 | 96 | 128 | 192 | 256 | 384 | 512): string | null {
  if (!url) return null;
  return url.startsWith("/api/org-files/") ? `${url}?w=${w}` : url;
}
