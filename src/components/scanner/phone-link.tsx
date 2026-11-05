"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useOrg } from "@/components/app/org-context";
import { useT } from "@/components/app/i18n-provider";
import { lookupCode } from "@/server/actions/products";
import { startRemoteScan, stopRemoteScan } from "@/server/actions/sales";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { SCAN_EVENT, scanFeedback } from "./use-scanner";

type Target = "here" | "sale" | "product";
interface PhoneLink {
  linked: boolean;
  connected: boolean;
  open: () => void;
}
const Ctx = createContext<PhoneLink>({ linked: false, connected: false, open: () => undefined });
export const usePhoneLink = () => useContext(Ctx);

const KEY = "galla.phoneLink";
const deliver = (code: string) => window.dispatchEvent(new CustomEvent(SCAN_EVENT, { detail: code }));

/**
 * One phone pairing for the whole app. Once linked, every screen that takes a barcode (POS, products,
 * purchases, stock counts…) receives the phone's scans. The phone also chooses where a scan goes:
 * the screen that is open, the sale, or the product page.
 */
export function PhoneLinkProvider({ children }: { children: React.ReactNode }) {
  const org = useOrg();
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<{ token: string; qr: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const [dialog, setDialog] = useState(false);
  const pendingSale = useRef<string[]>([]);
  const path = useRef(pathname);

  useEffect(() => {
    path.current = pathname;
    // Scans sent "to the sale" from another screen wait here until the POS has mounted its scanner.
    if (pathname === "/pos" && pendingSale.current.length) {
      const codes = pendingSale.current.splice(0);
      setTimeout(() => codes.forEach(deliver), 400);
    }
  }, [pathname]);

  // Resume a pairing after a reload (the server says if it has expired).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) QRCode.toDataURL(`${location.origin}/scan/${saved}`, { margin: 1, width: 240 }).then((qr) => setSession({ token: saved, qr }));
    } catch {}
  }, []);

  const route = useCallback(
    async (code: string, target: Target) => {
      scanFeedback(true);
      if (target === "sale" && org.can("pos:sell")) {
        if (path.current === "/pos") return deliver(code);
        pendingSale.current.push(code);
        toast.info(`Adding ${code} to the sale`);
        return router.push("/pos");
      }
      if (target === "product") {
        const res = await lookupCode({ code });
        if (res.ok && res.data) return router.push(`/products/${res.data.productId}`);
        if (org.can("products:write")) return router.push(`/products/new?barcode=${encodeURIComponent(code)}`);
        return toast.error(`No product with barcode ${code}`);
      }
      deliver(code);
    },
    [org, router],
  );
  const routeRef = useRef(route);
  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    if (!session) return;
    const es = new EventSource(`/api/scan/${encodeURIComponent(session.token)}/stream`);
    es.addEventListener("ready", () => setConnected(true));
    es.addEventListener("scan", (e) => {
      const { code, target } = JSON.parse((e as MessageEvent).data) as { code: string; target?: Target };
      routeRef.current(code, target ?? "here");
    });
    es.addEventListener("expired", () => {
      es.close();
      try {
        sessionStorage.removeItem(KEY);
      } catch {}
      setSession(null);
      setConnected(false);
      toast.info("Phone scanner disconnected");
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [session]);

  const open = useCallback(async () => {
    setDialog(true);
    if (session) return;
    const res = await startRemoteScan({});
    if (!res.ok) return toast.error(res.error);
    try {
      sessionStorage.setItem(KEY, res.data.token);
    } catch {}
    setSession({ token: res.data.token, qr: await QRCode.toDataURL(`${location.origin}/scan/${res.data.token}`, { margin: 1, width: 240 }) });
  }, [session]);

  async function unlink() {
    if (session) await stopRemoteScan({ token: session.token });
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    setSession(null);
    setConnected(false);
    setDialog(false);
  }

  return (
    <Ctx.Provider value={{ linked: !!session, connected, open }}>
      {children}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Use your phone as a scanner</DialogTitle>
            <DialogDescription>Scan this QR code with your phone and sign in with an account from this business. Scans then work on every screen, and the phone lets you send each one to the sale or to the product.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {session ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.qr} alt="Pairing QR code" className="size-60 rounded-lg border bg-white p-2" />
            ) : (
              <div className="grid size-60 place-items-center"><Spinner /></div>
            )}
            <p className="text-sm text-muted-foreground">{connected ? "Phone linked. Listening for scans…" : "Waiting for the phone…"}</p>
            {session && <Button variant="outline" onClick={unlink} className="w-full">Unlink phone</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

/** Header button: shows whether a phone is linked and opens the pairing QR. */
export function PhoneLinkButton({ compact = false }: { compact?: boolean }) {
  const { linked, connected, open } = usePhoneLink();
  const t = useT();
  return (
    <Button type="button" variant={linked ? "secondary" : "outline"} size={compact ? "sm" : "default"} onClick={open} aria-label={linked ? "Phone linked" : "Link a phone as scanner"}>
      <Smartphone className={linked && connected ? "text-success" : ""} />
      <span className="hidden lg:inline">{linked ? t("Phone linked") : t("Link phone")}</span>
    </Button>
  );
}
