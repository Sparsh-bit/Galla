"use client";
import { useEffect } from "react";

/** Marks <html> when running inside the Galla desktop (Electron) or phone (Capacitor) app so CSS can feel native. */
export function NativeShell() {
  useEffect(() => {
    const w = window as unknown as { gallaDesktop?: { platform: string }; Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };
    const platform = w.gallaDesktop ? "desktop-" + w.gallaDesktop.platform : w.Capacitor?.isNativePlatform?.() ? w.Capacitor.getPlatform?.() : null;
    if (!platform) return;
    const el = document.documentElement;
    el.classList.add("native-app");
    el.dataset.platform = platform;
    return () => {
      el.classList.remove("native-app");
      delete el.dataset.platform;
    };
  }, []);
  return null;
}
