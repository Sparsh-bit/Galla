"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { applyOfflineSale, buildOfflineBill, lookupInSnapshot, offlineSeries, searchSnapshot } from "@/lib/offline-bill";
import type { ReceiptData } from "@/lib/receipt";
import { getPosSnapshot, registerTill, syncOfflineSales } from "@/server/actions/offline";
import type { VariantHit } from "@/server/services/products";
import type { PosSnapshot } from "@/server/services/offline";
import type { CartLine, PosCustomer } from "@/components/pos/types";
import { clearOffline, getSnapshot, getTill, listQueued, nextOfflineSeq, queueSale, removeQueued, setSnapshot, setTill, type QueuedSale, type Till } from "./store";
import { useOnline } from "./use-online";

const REFRESH_MS = 10 * 60 * 1000;

function deviceName() {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "Device";
  return `Till on ${os}`;
}

export interface OfflineCheckout {
  lines: CartLine[];
  customer: PosCustomer | null;
  billDiscount: number;
  kind: "receipt" | "tax_invoice";
  payments: { method: "cash" | "card" | "upi" | "credit" | "other"; amount: number; reference: string }[];
  locationId: string;
  cashierName: string;
  clientId?: string;
}

export function useOfflinePos(orgId: string, locationId: string) {
  const online = useOnline();
  const [till, setTillState] = useState<Till | null>(null);
  const [snapshot, setSnap] = useState<PosSnapshot | null>(null);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshPending = useCallback(() => listQueued(orgId).then((q) => setPending(q.length)).catch(() => undefined), [orgId]);

  // Till identity + catalogue snapshot (cached copy first, fresh copy when online).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let t = await getTill(orgId);
        if (!t && navigator.onLine) {
          const r = await registerTill({ name: deviceName() });
          if (r.ok) {
            t = r.data;
            await setTill(orgId, t);
          }
        }
        if (alive && t) setTillState(t);
        const cached = await getSnapshot(orgId, locationId);
        if (alive && cached) setSnap(cached);
        await refreshPending();
      } catch {
        /* IndexedDB unavailable (private mode): offline selling is simply not offered */
      }
    })();
    return () => {
      alive = false;
    };
  }, [orgId, locationId, refreshPending]);

  useEffect(() => {
    if (!online) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await getPosSnapshot({ locationId });
        if (r.ok && alive) {
          setSnap(r.data);
          await setSnapshot(orgId, r.data);
        } else if (!r.ok && r.code === "LOCKED") {
          // Locked by Concilio: drop this device's offline copy so billing stops here too.
          await clearOffline(orgId).catch(() => undefined);
          window.location.replace(new URL("/locked", window.location.origin).href); // full reload drops everything held in memory
        }
      } catch {
        /* network blip: keep the cached snapshot */
      }
    };
    void load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [online, orgId, locationId]);

  const sync = useCallback(async () => {
    if (syncingRef.current || !till || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const queue = (await listQueued(orgId)).filter((q) => !q.error);
      let done = 0;
      const review: string[] = [];
      for (let i = 0; i < queue.length; i += 20) {
        const batch = queue.slice(i, i + 20);
        const r = await syncOfflineSales({ deviceToken: till.token, sales: batch.map((b) => b.payload) as never });
        if (!r.ok) {
          toast.error(`Sync paused: ${r.error}`);
          break;
        }
        for (const res of r.data) {
          const q = batch.find((b) => b.clientId === res.clientId)!;
          if (res.status === "rejected") await queueSale({ ...q, error: res.error });
          else {
            await removeQueued(res.clientId);
            done++;
            if (res.issues?.length) review.push(res.number);
          }
        }
      }
      if (done) toast.success(`${done} offline bill${done === 1 ? "" : "s"} synced`, review.length ? { description: `${review.length} need a manager's review (Sales → Needs review).` } : undefined);
    } catch {
      /* still offline; will retry */
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refreshPending();
    }
  }, [orgId, till, refreshPending]);

  // Auto-sync whenever we're online with queued bills.
  useEffect(() => {
    if (online && pending > 0 && till) void sync();
  }, [online, pending, till, sync]);

  const lookupLocal = useCallback((code: string): VariantHit | null => (snapshot ? lookupInSnapshot(snapshot, code) : null), [snapshot]);

  const searchLocal = useCallback((q: string) => (snapshot ? searchSnapshot(snapshot.variants, q) : []), [snapshot]);

  const customersLocal = useCallback(
    (q: string): PosCustomer[] => {
      if (!snapshot) return [];
      const t = q.trim().toLowerCase();
      return snapshot.customers.filter((c) => !t || c.name.toLowerCase().includes(t) || c.phone.includes(t) || c.taxId.toLowerCase().includes(t)).slice(0, 20);
    },
    [snapshot],
  );

  /** Saves a bill on this device with its final number from the till's own series (shared logic: lib/offline-bill). */
  const checkoutOffline = useCallback(
    async (o: OfflineCheckout): Promise<{ number: string; receipt: ReceiptData; total: number } | null> => {
      if (!till || !snapshot) {
        toast.error("This device isn't ready for offline billing yet. Open the POS once while online.");
        return null;
      }
      if (snapshot.licenseUntil && Date.now() > Date.parse(snapshot.licenseUntil)) {
        toast.error("Galla needs to check your subscription. Connect to the internet to keep billing.", { duration: 8000 });
        return null;
      }
      const now = new Date();
      const seq = await nextOfflineSeq(orgId, offlineSeries(snapshot.settings, o.kind, now).key);
      const clientId = o.clientId ?? crypto.randomUUID();
      const { number, receipt, payload, total } = buildOfflineBill({
        settings: snapshot.settings, tillCode: till.code, seq, now, clientId, locationId: o.locationId, cashierName: o.cashierName,
        kind: o.kind, customer: o.customer, billDiscount: o.billDiscount, lines: o.lines, payments: o.payments,
      });
      const queued: QueuedSale = { clientId, orgId, number, createdAt: payload.createdAt, receipt, payload };
      await queueSale(queued);
      // Keep the local snapshot honest so the next offline bill sees reduced stock and sold serials.
      const next = applyOfflineSale(snapshot, o.lines);
      setSnap(next);
      await setSnapshot(orgId, next);
      await refreshPending();
      return { number, receipt, total };
    },
    [orgId, till, snapshot, refreshPending],
  );

  return { online, ready: !!till && !!snapshot, till, snapshot, pending, syncing, sync, lookupLocal, searchLocal, customersLocal, checkoutOffline };
}
