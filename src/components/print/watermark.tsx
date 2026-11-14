import type { watermark } from "@/lib/receipt";

/** A faint picture behind the bill (words, or the shop logo). Prints too; content sits above it. */
export function Watermark({ w, size }: { w: ReturnType<typeof watermark>; size: string }) {
  if (!w) return null;
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 z-0 flex -rotate-[28deg] items-center justify-center text-center font-sans font-bold text-black/[0.08] [print-color-adjust:exact] ${size}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {"text" in w ? <span className="break-words">{w.text}</span> : <img src={w.logo} alt="" className="max-w-[70%] opacity-10 grayscale" />}
    </div>
  );
}
