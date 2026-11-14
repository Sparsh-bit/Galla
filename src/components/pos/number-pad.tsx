"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Delete, Hash } from "lucide-react";
import type { VariantHit } from "@/server/services/products";
import { useOrg } from "@/components/app/org-context";
import { scanFeedback } from "@/components/scanner/use-scanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MAX_DIGITS = 14;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * Product-number pad: type the product's number, check the name that appears, press Next. The bill gets
 * the item and the pad is empty and ready for the next number. A number that matches nothing can't be sent.
 */
export function NumberPad({
  open, onClose, peek, onNext, inBill,
}: {
  open: boolean;
  onClose: () => void;
  /** Looks the number up without adding it. */
  peek: (code: string) => Promise<VariantHit | null>;
  /** Adds it to the bill (asks first if it is already there). Resolves to a short message for the pad. */
  onNext: (code: string) => Promise<string | null>;
  /** How many of this variant are already in the bill. */
  inBill: (variantId: string) => number;
}) {
  const org = useOrg();
  const [digits, setDigits] = useState("");
  const [hit, setHit] = useState<VariantHit | null>(null);
  const [state, setState] = useState<"idle" | "looking" | "found" | "missing">("idle");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  // Preview the product as the number is typed, so a wrong digit is seen before it reaches the bill.
  useEffect(() => {
    if (!open) return;
    if (!digits) {
      seq.current++;
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setState("looking");
      const h = await peek(digits).catch(() => null);
      if (seq.current !== mine) return;
      setHit(h);
      setState(h ? "found" : "missing");
    }, 160);
    return () => clearTimeout(timer);
  }, [digits, open, peek]);

  const type = (d: string) => {
    setFlash("");
    setState(digits.length + 1 ? "looking" : "idle");
    setDigits((v) => (v.length < MAX_DIGITS ? v + d : v));
    navigator.vibrate?.(8);
  };
  const back = () => {
    setFlash("");
    setDigits((v) => v.slice(0, -1));
    if (digits.length <= 1) setState("idle");
  };
  const clear = () => {
    setFlash("");
    setDigits("");
    setState("idle");
  };
  const next = async () => {
    if (busy || !digits) return;
    setBusy(true);
    const code = digits;
    // Enter can arrive before the preview has finished: look it up now rather than ignore it.
    if (state !== "found" || !hit) {
      const h = await peek(code).catch(() => null);
      if (!h) {
        setHit(null);
        setState("missing");
        setBusy(false);
        scanFeedback(false);
        return;
      }
    }
    const msg = await onNext(code);
    setBusy(false);
    setDigits("");
    setState("idle");
    setHit(null);
    if (msg) setFlash(msg);
  };

  // Hardware keyboard works too: digits, Backspace, Escape clears, Enter = Next.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) type(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Enter") void next();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const already = hit ? inBill(hit.variantId) : 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[100dvh] max-w-sm gap-3 overflow-y-auto p-4 sm:max-w-sm [@media(max-height:720px)]:gap-2 [@media(max-height:720px)]:p-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Hash className="size-4" /> Product number</DialogTitle>
          <DialogDescription>Type the number, check the product, press Next.</DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border bg-muted/40 p-3" aria-live="polite">
          <div className="flex h-14 items-center justify-end font-mono text-4xl [@media(max-height:720px)]:h-10 [@media(max-height:720px)]:text-3xl font-semibold tracking-widest tabular-nums" aria-label={`Number typed: ${digits || "none"}`}>
            {digits || <span className="text-muted-foreground/40">0</span>}
          </div>
          <div className="mt-2 min-h-12 border-t pt-2 text-sm [@media(max-height:720px)]:min-h-10">
            {state === "found" && hit && (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{hit.name}{hit.variantName && <span className="font-normal text-muted-foreground"> · {hit.variantName}</span>}</p>
                  <p className="text-xs text-muted-foreground">{org.money(hit.salePrice)}{already > 0 && <span className="ml-2 font-medium text-amber-700">Already in bill ×{already}</span>}</p>
                </div>
                <Check className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
              </div>
            )}
            {state === "missing" && <p role="alert" className="font-medium text-destructive">No product has the number {digits}.</p>}
            {state === "looking" && <p className="text-muted-foreground">Checking…</p>}
            {state === "idle" && (flash ? <p role="status" className="font-medium text-emerald-700">{flash}</p> : <p className="text-muted-foreground">Ready for the next number.</p>)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Number pad">
          {KEYS.map((k) => (
            <Button key={k} type="button" variant="outline" className="h-16 text-2xl font-semibold [@media(max-height:720px)]:h-12" onClick={() => type(k)}>{k}</Button>
          ))}
          <Button type="button" variant="outline" className="h-16 text-base font-semibold [@media(max-height:720px)]:h-12" onClick={clear} aria-label="Clear number">Clear</Button>
          <Button type="button" variant="outline" className="h-16 text-2xl font-semibold [@media(max-height:720px)]:h-12" onClick={() => type("0")}>0</Button>
          <Button type="button" variant="outline" className="h-16 [@media(max-height:720px)]:h-12" onClick={back} aria-label="Delete last digit"><Delete className="size-6" /></Button>
        </div>

        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button type="button" variant="ghost" className="h-14 [@media(max-height:720px)]:h-12" onClick={onClose}>Done</Button>
          <Button type="button" className="h-14 text-lg font-semibold [@media(max-height:720px)]:h-12" disabled={state !== "found" || busy} onClick={() => void next()}>
            Next <ArrowRight className="ml-1 size-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

