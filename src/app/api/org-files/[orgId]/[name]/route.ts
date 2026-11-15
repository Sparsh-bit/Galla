import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { env } from "@/env";
import { loadCtx } from "@/server/context";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
const WIDTHS = new Set([64, 96, 128, 192, 256, 384, 512]);
// File names are random and never reused, so a browser or phone may keep an image for good. Private: signed-in staff only.
const CACHE = "private, max-age=31536000, immutable";

export async function GET(req: Request, { params }: RouteContext<"/api/org-files/[orgId]/[name]">) {
  const { orgId, name } = await params;
  const match = /^([a-f0-9]{24})\/([a-f0-9]{32})\.(png|jpg|webp)$/.exec(`${orgId}/${name}`);
  if (!match) return new Response("Not found", { status: 404 });
  const ctx = await loadCtx();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  if (ctx.orgId !== match[1]) return new Response("Not found", { status: 404 });

  const headers = { "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Cache-Control": CACHE };
  const original = path.join(path.resolve(env.UPLOAD_DIR, "images", ctx.orgId), match[2] + "." + match[3]);
  try {
    // ?w=96: a small copy for lists (a 48 px thumbnail must not download a 300 KB photo). Made once, then kept.
    const w = Number(new URL(req.url).searchParams.get("w"));
    if (WIDTHS.has(w)) {
      const thumb = path.join(path.resolve(env.UPLOAD_DIR, "thumbs", ctx.orgId, String(w)), match[2] + ".webp");
      const cached = await readFile(thumb).catch(() => null);
      if (cached) return new Response(new Uint8Array(cached), { headers: { ...headers, "Content-Type": "image/webp" } });
      try {
        const { default: sharp } = await import("sharp");
        const out = await sharp(await readFile(original)).rotate().resize(w, w, { fit: "cover" }).webp({ quality: 78 }).toBuffer();
        await mkdir(path.dirname(thumb), { recursive: true }).then(() => writeFile(thumb, out)).catch(() => undefined);
        return new Response(new Uint8Array(out), { headers: { ...headers, "Content-Type": "image/webp" } });
      } catch {
        /* could not shrink it: send the original below */
      }
    }
    const data = await readFile(original);
    return new Response(new Uint8Array(data), { headers: { ...headers, "Content-Type": TYPES[match[3]] } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
