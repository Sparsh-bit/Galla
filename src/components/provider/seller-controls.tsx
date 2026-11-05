"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, LockOpen, Trash2 } from "lucide-react";
import { deleteSellerAction, recordPaymentAction, resetOwnerPasswordAction, setLockedAction, updateSubscriptionAction } from "@/server/actions/provider";
import { FormField } from "@/components/app/form-field";
import { useAction } from "@/components/app/use-action";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const toPaise = (v: string) => Math.round((Number(String(v).replace(/[^\d.]/g, "")) || 0) * 100);
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

interface Sub { plan: string; priceMonthly: number; paidUntil: Date | string | null; status: string; lockReason: string; notes: string }

export function SubscriptionForm({ orgId, sub }: { orgId: string; sub: Sub }) {
  const [f, setF] = useState({ plan: sub.plan, price: String(sub.priceMonthly / 100), paidUntil: iso(sub.paidUntil), notes: sub.notes });
  const { run, pending } = useAction(updateSubscriptionAction);
  return (
    <Card>
      <CardHeader><CardTitle>Subscription</CardTitle><CardDescription>When &ldquo;paid until&rdquo; passes, the seller is locked out automatically on every device.</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run({ orgId, plan: f.plan, priceMonthly: toPaise(f.price), paidUntil: f.paidUntil || null, notes: f.notes }, { success: "Subscription saved" }); }}>
          <FormField label="Plan"><Input value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} required /></FormField>
          <FormField label="Price per month (₹)"><Input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} inputMode="decimal" /></FormField>
          <FormField label="Paid until" description="Empty = no expiry."><Input type="date" value={f.paidUntil} onChange={(e) => setF({ ...f, paidUntil: e.target.value })} /></FormField>
          <FormField label="Notes" className="sm:col-span-3" optional><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></FormField>
          <div className="sm:col-span-3"><Button type="submit" disabled={pending}>{pending && <Spinner />} Save subscription</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PaymentForm({ orgId }: { orgId: string }) {
  const [f, setF] = useState({ amount: "", months: "1", method: "upi", reference: "", note: "" });
  const { run, pending } = useAction(recordPaymentAction);
  return (
    <Card>
      <CardHeader><CardTitle>Record a payment</CardTitle><CardDescription>Extends &ldquo;paid until&rdquo; by the months paid for, and unlocks an expired seller.</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); run({ orgId, amount: toPaise(f.amount), months: Number(f.months), method: f.method as "upi", reference: f.reference, note: f.note }, { success: "Payment recorded", onSuccess: () => setF({ ...f, amount: "", reference: "", note: "" }) }); }}>
          <FormField label="Amount (₹)"><Input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} inputMode="decimal" required /></FormField>
          <FormField label="Months"><Input type="number" min={1} max={60} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} required /></FormField>
          <FormField label="Method">
            <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className="h-8 rounded-lg border bg-background px-2 text-sm">
              {["upi", "bank", "cash", "card", "other"].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </FormField>
          <FormField label="Reference" optional><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></FormField>
          <div className="sm:col-span-4"><Button type="submit" disabled={pending}>{pending && <Spinner />} Record payment</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AccessControls({ orgId, name, locked, reason }: { orgId: string; name: string; locked: boolean; reason: string }) {
  const router = useRouter();
  const [why, setWhy] = useState(reason);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const lock = useAction(setLockedAction);
  const reset = useAction(resetOwnerPasswordAction);
  const del = useAction(deleteSellerAction);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">{locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />} {locked ? "Unlock seller" : "Lock seller"}</CardTitle><CardDescription>{locked ? "They can sign in and bill again." : "Signs them out of every device now. They see “subscription expired” and can't sign in; offline tills stop within 72 hours."}</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {!locked && <FormField label="Reason (shown to staff only)" optional><Input value={why} onChange={(e) => setWhy(e.target.value)} /></FormField>}
          <Button variant={locked ? "default" : "destructive"} disabled={lock.pending} onClick={() => lock.run({ orgId, locked: !locked, reason: why }, { success: locked ? "Seller unlocked" : "Seller locked and signed out everywhere" })}>
            {lock.pending && <Spinner />} {locked ? "Unlock" : "Lock now"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-4" /> Reset owner password</CardTitle><CardDescription>Sets a new password and signs the owner out everywhere.</CardDescription></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); reset.run({ orgId, password: pw }, { success: "Password reset", onSuccess: () => setPw("") }); }}>
            <FormField label="New password"><PasswordInput autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={10} required /></FormField>
            <Button type="submit" variant="outline" disabled={reset.pending}>{reset.pending && <Spinner />} Set password</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="ring-destructive/30">
        <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="size-4" /> Delete permanently</CardTitle><CardDescription>Erases the store, its products, bills, khata, files and users who belong only to it. This cannot be undone.</CardDescription></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); del.run({ orgId, confirmName: confirm }, { success: "Seller deleted", onSuccess: () => { router.replace("/provider"); router.refresh(); } }); }}>
            <FormField label={`Type “${name}” to confirm`}><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></FormField>
            <Button type="submit" variant="destructive" disabled={del.pending || confirm.trim() !== name}>{del.pending && <Spinner />} Delete seller</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
