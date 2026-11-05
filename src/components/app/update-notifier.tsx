"use client";
import { useEffect } from "react";
import { toast } from "sonner";

const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * After we deploy, apps and tabs that are already open are still running the old screens.
 * Check the live build now and then (and when the window regains focus or comes back online)
 * and offer a one-click reload, so every device moves to the new version.
 */
export function UpdateNotifier() {
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_GALLA_BUILD;
    if (!mine) return;
    let shown = false;
    let last = 0;
    const check = async () => {
      if (shown || !navigator.onLine || Date.now() - last < 30_000) return;
      last = Date.now();
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (!build || build === mine) return;
        shown = true;
        toast("A new version of Galla is ready", {
          description: "Reload to get the latest features and fixes. Nothing you saved is lost.",
          duration: Infinity,
          action: { label: "Reload", onClick: () => location.reload() },
        });
      } catch {}
    };
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
