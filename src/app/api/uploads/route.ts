import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { readLimitedForm } from "@/lib/limited-form-data";
import { loadCtx, allowed } from "@/server/context";
import { csrfOk } from "@/server/http";
import { RateLimit } from "@/server/models";

const MAX_IMAGE = 15 * 1024 * 1024; // phone cameras make 4–15 MB photos; they are shrunk below, so this only bounds the upload
const MAX_DOC = 10 * 1024 * 1024;
const MAX_MULTIPART = MAX_DOC + 64 * 1024;

/** Identify by magic bytes, never by the client-supplied type or name. */
function sniff(b: Buffer): "png" | "jpg" | "webp" | "pdf" | null {
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (b.length > 5 && b.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  return null;
}

/**
 * kind=image (default): product images and logos, PNG/JPG/WebP up to 2 MB.
 * kind=doc: supplier bills and receipts (images or PDF up to 10 MB), stored per business and
 * served only to that business (/api/docs).
 */
export async function POST(req: Request) {
  if (!csrfOk(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const declaredSize = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_MULTIPART) {
    return NextResponse.json({ error: "Upload is too large" }, { status: 413 });
  }
  const ctx = await loadCtx();
  if (!ctx) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const canUploadImage = allowed(ctx, "products:write") || allowed(ctx, "settings:manage");
  const canUploadDoc = allowed(ctx, "purchases:write");
  if (!canUploadImage && !canUploadDoc) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const rate = await RateLimit.findOneAndUpdate(
    { key: `upload:${ctx.orgId}:${ctx.userId}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 15 * 60 * 1000) } },
    { upsert: true, returnDocument: "after" },
  );
  if ((rate?.count ?? 0) > 20) return NextResponse.json({ error: "Too many uploads. Try again in 15 minutes." }, { status: 429 });
  let tooLarge = false;
  const form = await readLimitedForm(req, MAX_MULTIPART, () => { tooLarge = true; }).catch(() => null);
  if (tooLarge) return NextResponse.json({ error: "Upload is too large" }, { status: 413 });
  const doc = form?.get("kind") === "doc";
  const permitted = doc ? canUploadDoc : canUploadImage;
  if (!permitted) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const max = doc ? MAX_DOC : MAX_IMAGE;
  if (file.size > max) return NextResponse.json({ error: `File must be ${max / 1024 / 1024} MB or smaller` }, { status: 413 });
  let buf: Buffer = Buffer.from(await file.arrayBuffer());
  let ext = sniff(buf);
  if (!ext || (!doc && ext === "pdf")) return NextResponse.json({ error: doc ? "Only photos (PNG, JPG, WebP) or PDF files are allowed" : "Only PNG, JPG or WebP images are allowed" }, { status: 415 });
  // Product photos and logos are resized here so every app (web, Android, desktop) sends whatever its camera
  // makes. Straightened by the photo's rotation tag; `crop=square` centres a square (the in-app camera frame).
  if (!doc) {
    try {
      const { default: sharp } = await import("sharp"); // a missing native build must not break uploads
      let img = sharp(buf, { limitInputPixels: 120_000_000 }).rotate();
      img = form?.get("crop") === "square" ? img.resize(1200, 1200, { fit: "cover", position: "centre" }) : img.resize(1600, 1600, { fit: "inside", withoutEnlargement: true });
      const keep = ext === "png" ? "png" : ext === "webp" ? "webp" : "jpg";
      buf = await (keep === "png" ? img.png({ compressionLevel: 9 }) : keep === "webp" ? img.webp({ quality: 82 }) : img.jpeg({ quality: 82, mozjpeg: true })).toBuffer();
      ext = keep;
    } catch (e) {
      // Could not be decoded: only fine if it is already small (a corrupt or huge file is refused).
      console.warn("[uploads] image not resized", e);
      if (buf.length > 2 * 1024 * 1024) return NextResponse.json({ error: "That picture could not be read. Try another photo." }, { status: 415 });
    }
  }
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  const dir = doc
    ? path.resolve(env.UPLOAD_DIR, "docs", ctx.orgId)
    : path.resolve(env.UPLOAD_DIR, "images", ctx.orgId);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf, { flag: "wx" });
  } catch (e) {
    // Usually a missing or read-only storage volume on the host. Say so instead of a blank 500.
    console.error("[uploads] cannot write to", dir, e);
    return NextResponse.json({ error: "The server could not save the file. Ask Concilio Solutions to check the file storage." }, { status: 500 });
  }
  if (!doc) return NextResponse.json({ url: `/api/org-files/${ctx.orgId}/${name}` });
  const original = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || name;
  return NextResponse.json({ url: `/api/docs/${name}`, name: original, type: ext, size: buf.length });
}
