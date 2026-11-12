import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  let src = "";
  try {
    const file = path.join(process.cwd(), "public/brand/apple-touch-icon.png");
    src = `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: 38,
          overflow: "hidden",
        }}
      >
        {src ? (
          <img src={src} alt="Galla" width={150} height={150} style={{ objectFit: "contain" }} />
        ) : (
          <svg width={150} height={150} viewBox="0 0 100 114">
            <path d="M 23 2 L 77 2 L 95 27 C 94 32 85 33 82 29 C 78 33 69 33 66 29 C 62 33 53 33 50 29 C 46 33 37 33 34 29 C 31 33 22 33 19 29 C 16 33 7 32 5 27 Z" fill="#047348" />
            <path d="M 44 28 C 22 28 8 44 8 68 C 8 93 24 112 50 112 C 72 112 88 98 92 78 L 92 48 L 52 48 L 52 64 L 75 64 C 74 74 65 82 51 82 C 34 82 25 72 25 58 C 25 43 35 34 49 34 L 54 34 Z" fill="#032048" />
            <rect x="52" y="52" width="28" height="34" rx="4" fill="#047348" />
            <rect x="57" y="59" width="18" height="2.8" rx="1.4" fill="#ffffff" />
            <rect x="57" y="66" width="18" height="2.8" rx="1.4" fill="#ffffff" />
            <rect x="57" y="73" width="13" height="2.8" rx="1.4" fill="#ffffff" />
          </svg>
        )}
      </div>
    ),
    size,
  );
}
