const MAX_SIDE = 1600;

/** Phone photos are often 4–10 MB: shrink big ones to a sharp JPEG before uploading (small ones go as they are). */
export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 400 * 1024) return file;
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * k);
    canvas.height = Math.round(img.height * k);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // not decodable here: let the server judge it
  }
}

/** Uploads a product photo or logo and returns its URL. Throws a readable message on any failure. */
export async function uploadImage(file: File): Promise<string> {
  const blob = await shrinkImage(file);
  const body = new FormData();
  body.append("file", blob, blob === file ? file.name : file.name.replace(/\.\w+$/, "") + ".jpg");
  let res: Response;
  try {
    res = await fetch("/api/uploads", { method: "POST", body });
  } catch {
    throw new Error("Couldn't reach the server. Check the internet connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? `Upload failed (${res.status}). Please try again.`);
  return json.url;
}
