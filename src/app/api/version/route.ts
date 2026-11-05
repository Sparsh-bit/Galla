import { NextResponse } from "next/server";
import { env } from "@/env";

/** Which server build is live, so open apps can offer a reload after a deploy. Public and cache-free. */
export function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_GALLA_BUILD, minDesktopVersion: env.MIN_DESKTOP_VERSION ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const dynamic = "force-dynamic";
