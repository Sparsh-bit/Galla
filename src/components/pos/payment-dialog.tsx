"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Banknote, CreditCard, Landmark, Plus, Smartphone, X } from "lucide-react";
import { fromMinor, toMinor } from "@/lib/money";
import { checkTenders, quickCash } from "@/lib/pos-cart";
import { useOrg } from "@/components/app/org-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/app/i18n-provider";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Method = "cash" | "card" | "upi" | "credit";
export interface Tender {
  method: Method;
  amount: number;
  reference: string;
}

const METHODS: { id: Method; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "credit", label: "On account", icon: Landmark },
];

export function PaymentDialog({
  open, onOpenChange, total, hasCustomer, customerName, customerPicker, upiId, orgName, pending, kind, onKindChange, onPay,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; total: number; hasCustomer: boolean; customerName?: string; customerPicker?: React.ReactNode; upiId: string; orgName: string; pending: boolean;
  kind: "receipt" | "tax_invoice"; onKindChange: (k: "receipt" | "tax_invoice") => void; onPay: (tenders: Tender[]) => void;
}) {
  const t = useT();
  const org = useOrg();
  // The POS remounts this dialog (via `key`) each time it opens, so initial state is fresh.
  const [rows, setRows] = useState<{ method: Method; amount: string; reference: string }[]>(() => [{ method: "cash", amount: fromMinor(total), reference: "" }]);
  // Udhaar: the customer pays part now (maybe nothing) and the rest goes on their khata.
  const [mode, setMode] = useState<"paid" | "udhaar">("paid");
  const [paidNow, setPaidNow] = useState("");
  const [paidVia, setPaidVia] = useState<"cash" | "upi" | "card">("cash");
  const [qrImg, setQrImg] = useState<{ url: string; data: string } | null>(null);

  const parsed = rows.map((r) => {
    try {
      return r.amount.trim() ? toMinor(r.amount) : 0;
    } catch {
      return NaN;
    }
  });
  // Shared with the Android app (lib/pos-cart): enough paid, change only from cash, credit needs a customer.
  const check = checkTenders(total, rows.map((r, i) => ({ method: r.method, amount: parsed[i] })), hasCustomer);
  const { cash, remaining, change } = check;
  const invalid = !!check.problem || (rows.some((r) => r.method === "credit") && !hasCustomer);
  const upiAmount = rows.reduce((a, r, i) => a + (r.method === "upi" ? parsed[i] || 0 : 0), 0);

  const upiUrl = useMemo(
    () => (upiId && upiAmount > 0 ? `upi://pay?${new URLSearchParams({ pa: upiId, pn: orgName.slice(0, 50), am: (upiAmount / 100).toFixed(2), cu: org.currency })}` : null),
    [upiId, upiAmount, orgName, org.currency],
  );
  useEffect(() => {
    if (!upiUrl) return;
    let alive = true;
    QRCode.toDataURL(upiUrl, { margin: 1, width: 200 }).then((data) => alive && setQrImg({ url: upiUrl, data }), () => undefined);
    return () => {
      alive = false;
    };
  }, [upiUrl]);
  const qr = upiUrl && qrImg?.url === upiUrl ? qrImg.data : null;

  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  let paidMinor = 0;
  try {
    paidMinor = paidNow.trim() ? toMinor(paidNow) : 0;
  } catch {
    paidMinor = NaN;
  }
  const left = total - (Number.isFinite(paidMinor) ? paidMinor : 0);
  const udhaarProblem = !hasCustomer ? "Choose the customer first: their name is needed to keep the khata." : !Number.isFinite(paidMinor) || paidMinor < 0 ? "Check the amount paid." : paidMinor >= total ? "The full amount is paid, so choose Paid in full." : null;
  const submit = () => {
    if (pending) return;
    if (mode === "udhaar") {
      if (udhaarProblem) return;
      return onPay([...(paidMinor > 0 ? [{ method: paidVia, amount: paidMinor, reference: "" }] : []), { method: "credit" as const, amount: left, reference: "" }]);
    }
    if (!invalid) onPay(rows.map((r, i) => ({ method: r.method, amount: parsed[i], reference: r.reference.trim() })).filter((t) => t.amount > 0));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey || (e.target as HTMLElement).tagName !== "BUTTON")) { e.preventDefault(); submit(); } }}>
        <DialogHeader>
          <DialogTitle>{t("Take payment")}</DialogTitle>
          <DialogDescription>{t("Split across methods if the customer pays in parts.")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-primary/5 p-4 text-center">
          <p className="text-sm text-muted-foreground">{t("Amount due")}</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">{org.money(total)}</p>
        </div>

        {org.taxMode === "GST" && (
          <ToggleGroup type="single" variant="outline" value={kind} onValueChange={(v) => v && onKindChange(v as "receipt" | "tax_invoice")} className="w-full">
            <ToggleGroupItem value="receipt" className="flex-1">Receipt</ToggleGroupItem>
            <ToggleGroupItem value="tax_invoice" className="flex-1" disabled={!hasCustomer}>Tax invoice (B2B)</ToggleGroupItem>
          </ToggleGroup>
        )}

        <ToggleGroup type="single" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as "paid" | "udhaar")} className="w-full" aria-label="How is this bill paid">
          <ToggleGroupItem value="paid" className="flex-1">Paid in full</ToggleGroupItem>
          <ToggleGroupItem value="udhaar" className="flex-1">Udhaar (pay later)</ToggleGroupItem>
        </ToggleGroup>

        {mode === "udhaar" && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Customer (name is required)</Label>
              {customerPicker}
              {!hasCustomer && <p className="text-xs text-destructive">Pick or add the customer. Their name keeps the khata correct.</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="paid-now" className="text-xs">Paid now (leave empty if nothing)</Label>
              <div className="flex gap-2">
                <Input id="paid-now" inputMode="decimal" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} onFocus={(e) => e.target.select()} className="h-10 flex-1 text-lg tabular-nums" placeholder="0" aria-invalid={!Number.isFinite(paidMinor) || undefined} autoFocus />
                <div className="flex gap-1" role="group" aria-label="Paid by">
                  {(["cash", "upi", "card"] as const).map((m) => <Button key={m} type="button" size="sm" className="h-10" variant={paidVia === m ? "default" : "outline"} aria-pressed={paidVia === m} onClick={() => setPaidVia(m)}>{m === "upi" ? "UPI" : m[0].toUpperCase() + m.slice(1)}</Button>)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-warning/10 px-4 py-3">
              <span className="text-sm">Goes to {customerName ? `${customerName}’s` : "the customer’s"} udhaar</span>
              <span className="text-2xl font-semibold tabular-nums">{org.money(Math.max(0, Number.isFinite(left) ? left : total))}</span>
            </div>
            {udhaarProblem && hasCustomer && <p className="text-sm text-destructive">{udhaarProblem}</p>}
          </div>
        )}

        <div className={mode === "paid" ? "space-y-3" : "hidden"}>
          {rows.map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="flex gap-1.5">
                {METHODS.map((m) => (
                  <Button key={m.id} type="button" size="sm" variant={r.method === m.id ? "default" : "outline"} className="flex-1 px-1" onClick={() => setRow(i, { method: m.id })} disabled={m.id === "credit" && !hasCustomer} aria-pressed={r.method === m.id}>
                    <m.icon /> <span className="truncate">{t(m.label)}</span>
                  </Button>
                ))}
                {rows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove payment" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`amt-${i}`} className="text-xs">{t("Amount")}</Label>
                  <Input id={`amt-${i}`} inputMode="decimal" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} onFocus={(e) => e.target.select()} className="h-10 text-lg tabular-nums" autoFocus={i === 0} aria-invalid={!Number.isFinite(parsed[i]) || undefined} />
                </div>
                {(r.method === "card" || r.method === "upi") && (
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`ref-${i}`} className="text-xs">Reference (optional)</Label>
                    <Input id={`ref-${i}`} value={r.reference} onChange={(e) => setRow(i, { reference: e.target.value })} className="h-10" maxLength={100} placeholder={r.method === "card" ? "Last 4 / approval" : "UTR"} />
                  </div>
                )}
              </div>
              {r.method === "cash" && (
                <div className="flex flex-wrap gap-1.5">
                  {quickCash(total - parsed.reduce((a, p, j) => a + (j !== i && Number.isFinite(p) ? p : 0), 0)).map((v) => (
                    <Button key={v} type="button" variant="secondary" size="sm" className="tabular-nums" onClick={() => setRow(i, { amount: fromMinor(v) })}>
                      {org.money(v)}
                    </Button>
                  ))}
                </div>
              )}
              {r.method === "credit" && <p className="text-xs text-muted-foreground">Added to the customer&apos;s account balance.</p>}
            </div>
          ))}
          {remaining > 0 && rows.length < 4 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { method: "card", amount: fromMinor(remaining), reference: "" }])}>
              <Plus /> Split payment ({org.money(remaining)} left)
            </Button>
          )}
        </div>

        {qr && (
          <div className="flex items-center gap-4 rounded-lg border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="UPI QR code" className="size-28 rounded bg-white p-1" />
            <p className="text-sm text-muted-foreground">Ask the customer to scan with any UPI app to pay <strong className="text-foreground">{org.money(upiAmount)}</strong>.</p>
          </div>
        )}

        <div className={mode === "paid" ? "flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3 text-sm" : "hidden"}>
          {remaining > 0 ? (
            <span className="text-destructive">{t("Still due")} <strong className="tabular-nums">{org.money(remaining)}</strong></span>
          ) : (
            <span>{t("Change to return")}</span>
          )}
          <span className="text-2xl font-semibold tabular-nums">{org.money(change)}</span>
        </div>
        {mode === "paid" && change > cash && <p className="text-sm text-destructive">Only cash can be over-paid.</p>}

        <DialogFooter>
          <Button size="lg" className="h-11 w-full text-base" disabled={(mode === "paid" ? invalid : !!udhaarProblem) || pending} onClick={submit}>
            {pending && <Spinner />} {mode === "udhaar" ? "Save on udhaar" : t("Complete sale")} <Kbd className="ml-2 bg-primary-foreground/20 text-primary-foreground">Enter</Kbd>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
