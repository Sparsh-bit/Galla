"use client";
import { useState, useSyncExternalStore } from "react";
import { CheckCircle2, Keyboard, MonitorSmartphone, Package, ReceiptText, ScanLine, XCircle } from "lucide-react";
import { CameraScanner } from "@/components/scanner/camera-scanner";
import { scanFeedback } from "@/components/scanner/use-scanner";
import { LogoMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Target = "here" | "sale" | "product";
interface Sent {
  code: string;
  ok: boolean;
  at: number;
  target: Target;
}
const TARGETS: { id: Target; label: string; hint: string; icon: typeof ScanLine }[] = [
  { id: "sale", label: "Sale", hint: "Adds to the bill on the computer", icon: ReceiptText },
  { id: "product", label: "Product", hint: "Opens the product (or creates it)", icon: Package },
  { id: "here", label: "This screen", hint: "Goes to whatever is open", icon: ScanLine },
];
const TARGET_KEY = "galla.scanTarget";
// The phone remembers where scans go (saved in this browser), without a hydration mismatch.
const targetListeners = new Set<() => void>();
function readTarget(): Target {
  try {
    const t = localStorage.getItem(TARGET_KEY);
    return t === "product" || t === "here" ? t : "sale";
  } catch {
    return "sale";
  }
}
function saveTarget(t: Target) {
  try {
    localStorage.setItem(TARGET_KEY, t);
  } catch {}
  targetListeners.forEach((l) => l());
}
const subscribeTarget = (l: () => void) => (targetListeners.add(l), () => targetListeners.delete(l));

export function PhoneScanner({ token, valid, orgName }: { token: string; valid: boolean; orgName: string }) {
  const [sent, setSent] = useState<Sent[]>([]);
  const [expired, setExpired] = useState(!valid);
  const [manual, setManual] = useState("");
  const target = useSyncExternalStore(subscribeTarget, readTarget, () => "sale" as Target);
  const choose = saveTarget;

  async function send(code: string) {
    try {
      const res = await fetch(`/api/scan/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, target }) });
      if (res.status === 410) setExpired(true);
      scanFeedback(res.ok);
      setSent((s) => [{ code, ok: res.ok, at: Date.now(), target }, ...s].slice(0, 30));
    } catch {
      scanFeedback(false);
      setSent((s) => [{ code, ok: false, at: Date.now(), target }, ...s].slice(0, 30));
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <LogoMark className="size-7" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{orgName}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MonitorSmartphone className="size-3" /> Scanning to your computer
          </p>
        </div>
      </header>
      {expired ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <XCircle className="size-10 text-destructive" />
          <h1 className="text-lg font-semibold">Pairing expired</h1>
          <p className="text-sm text-muted-foreground">Open “Use phone as scanner” on the computer and scan the new QR code.</p>
        </div>
      ) : (
        <main className="flex flex-1 flex-col gap-4 p-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-muted-foreground">Send scans to</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {TARGETS.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={target === t.id} onClick={() => choose(t.id)} className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-semibold transition ${target === t.id ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary" : "bg-card text-muted-foreground"}`}>
                  <t.icon className="size-5" />
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{TARGETS.find((t) => t.id === target)?.hint}</p>
          </fieldset>
          <CameraScanner onScan={send} className="aspect-[3/4] w-full sm:aspect-video" />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) send(manual.trim());
              setManual("");
            }}
          >
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type a barcode" aria-label="Type a barcode" inputMode="text" />
            <Button type="submit" variant="secondary">
              <Keyboard /> Send
            </Button>
          </form>
          <section aria-live="polite">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Sent ({sent.length})</h2>
            <ul className="divide-y rounded-lg border">
              {sent.length === 0 && <li className="p-3 text-sm text-muted-foreground">Point the camera at a barcode.</li>}
              {sent.map((s) => (
                <li key={s.at} className="flex items-center gap-2 p-3 font-mono text-sm">
                  {s.ok ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
                  <span className="flex-1">{s.code}</span>
                  <span className="font-sans text-xs text-muted-foreground">{TARGETS.find((t) => t.id === s.target)?.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      )}
    </div>
  );
}
