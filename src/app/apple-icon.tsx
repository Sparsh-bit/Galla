import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#fbbf4a,#e07b12)" }}>
<svg width={150} height={150} viewBox="0 0 32 32">
  <circle cx="16" cy="8.6" r="3.9" fill="#14161f" />
  <path d="M14 7.2h4M14 8.9h4M14.2 7.2c2.7 0 2.7 3 0 3H14l3.1 2.6" fill="none" stroke="#fbbf4a" strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="round" />
  <rect x="5.5" y="16.6" width="21" height="9.6" rx="2.6" fill="#14161f" />
  <rect x="12.5" y="20.4" width="7" height="1.8" rx="0.9" fill="#fbbf4a" />
</svg>
      </div>
    ),
    size,
  );
}
