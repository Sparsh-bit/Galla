"use client";
import { useEffect } from "react";

/** Marks <html> when running inside the Galla desktop app (Electron) so CSS can feel native. */
export function NativeShell() {
  useEffect(() => {
    const w = window as unknown as { gallaDesktop?: { platform: string } };
    if (!w.gallaDesktop) return;
    const el = document.documentElement;
    el.classList.add("native-app");
    el.dataset.platform = "desktop-" + w.gallaDesktop.platform;
    return () => {
      el.classList.remove("native-app");
      delete el.dataset.platform;
    };
  }, []);
  return null;
}
