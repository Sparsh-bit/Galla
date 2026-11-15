"use client";
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Browser connectivity (true on the server render). */
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** True when a server action failed because the network is down (not a server-side error). */
export function isNetworkError(e: unknown) {
  return e instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
}

/**
 * True when the page is older than the server (we deployed while it was open): Next answers an action it no longer
 * knows with "unexpected response", or an old script file is gone. Reloading fixes it; this does that once.
 */
export function reloadIfStale(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (!/unexpected response|server action|loading chunk|chunkloaderror/i.test(msg) || typeof window === "undefined") return false;
  try {
    if (Date.now() - Number(sessionStorage.getItem("galla.reloaded") ?? 0) < 30_000) return false; // never loop
    sessionStorage.setItem("galla.reloaded", String(Date.now()));
  } catch {}
  window.location.reload();
  return true;
}
