"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

const SINCE_KEY = "galla.offlineSince";
const PING_MS = 15_000;

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

async function reachable() {
  try {
    const res = await fetch("/api/version", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Tells the cashier the moment the connection drops (browser offline, or the server can't be reached),
 * with a running timer, and that billing carries on: the POS keeps selling from this device and the
 * bills sync by themselves when the connection is back.
 */
export function ConnectionBanner() {
  const pathname = usePathname();
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const sinceRef = useRef<number | null>(null);

  useEffect(() => {
    let failures = 0;
    let stopped = false;
    const goOffline = () => {
      if (sinceRef.current) return;
      let start = Date.now();
      try {
        start = Number(sessionStorage.getItem(SINCE_KEY)) || start;
        sessionStorage.setItem(SINCE_KEY, String(start));
      } catch {}
      sinceRef.current = start;
      setSince(start);
    };
    const goOnline = () => {
      if (!sinceRef.current) return;
      const was = Date.now() - sinceRef.current;
      sinceRef.current = null;
      setSince(null);
      try {
        sessionStorage.removeItem(SINCE_KEY);
      } catch {}
      toast.success(`Back online after ${fmt(was)}`, { description: "Offline bills are syncing now." });
    };
    const check = async () => {
      if (!navigator.onLine) return goOffline();
      if (await reachable()) {
        failures = 0;
        goOnline();
      } else if (++failures >= 2) goOffline(); // two misses in a row: the server really is out of reach
    };
    const onOffline = () => goOffline();
    const onOnline = () => void check();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    const ping = setInterval(() => !stopped && check(), PING_MS);
    const tick = setInterval(() => sinceRef.current && setNow(Date.now()), 1000);
    if (!navigator.onLine) goOffline();
    return () => {
      stopped = true;
      clearInterval(ping);
      clearInterval(tick);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!since) return null;
  return (
    <div role="alert" className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning/40 bg-warning/20 px-4 py-2 text-sm text-warning-foreground dark:text-warning">
      <WifiOff className="size-4 shrink-0" />
      <strong className="font-semibold">No internet · <span className="tabular-nums">{fmt((now || since) - since)}</span></strong>
      <span className="text-foreground/80">Billing keeps working on this device. Bills sync automatically when you&apos;re back online.</span>
      {pathname !== "/pos" && (
        <Link href="/pos" className="ml-auto rounded-md bg-background/70 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-background">Open billing</Link>
      )}
    </div>
  );
}
