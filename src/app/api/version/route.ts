import { NextResponse } from "next/server";
import { env } from "@/env";

/**
 * Which server build is live, plus the newest app versions, so open apps can offer an update.
 * Public and cache-free. `android` is set by the operator (ANDROID_APP_VERSION, optional ANDROID_APK_URL)
 * when a new APK is published; the app checks it at launch, every few hours and when it returns to the foreground.
 */
export function GET() {
  return NextResponse.json(
    {
      build: process.env.NEXT_PUBLIC_GALLA_BUILD,
      minDesktopVersion: env.MIN_DESKTOP_VERSION ?? null,
      minAndroidVersion: env.MIN_ANDROID_VERSION ?? null,
      android: env.ANDROID_APP_VERSION ? { version: env.ANDROID_APP_VERSION, url: env.ANDROID_APK_URL ?? "/downloads/Galla-android.apk" } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const dynamic = "force-dynamic";
