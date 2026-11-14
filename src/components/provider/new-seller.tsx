"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createSellerAction } from "@/server/actions/provider";
import { FormField } from "@/components/app/form-field";
import { useAction } from "@/components/app/use-action";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PlanPicker, type PlanValue } from "./plan-picker";
import { PLAN_PRESETS } from "@/lib/features";

const toPaise = (v: string) => Math.round((Number(v.replace(/[^\d.]/g, "")) || 0) * 100);

/** Create a seller: their login (email + password) and their store. They do everything else themselves. */
export function NewSeller() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ storeName: "", ownerName: "", email: "", password: "", phone: "", taxId: "", price: "", paidUntil: "" });
  const [pl, setPl] = useState<PlanValue>({ plan: "Dukaan", features: [...PLAN_PRESETS.Dukaan.features], maxStaff: PLAN_PRESETS.Dukaan.maxStaff });
  const { run, pending } = useAction(createSellerAction);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> New seller</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New seller</DialogTitle>
            <DialogDescription>Creates the owner&apos;s login and their store. Share the email and password with them; they can change the password after signing in.</DialogDescription>
          </DialogHeader>
          <form
            id="new-seller"
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                { storeName: f.storeName, ownerName: f.ownerName, email: f.email, password: f.password, phone: f.phone, taxId: f.taxId, stateCode: f.taxId.slice(0, 2), plan: pl.plan, features: pl.features, maxStaff: pl.maxStaff, priceMonthly: toPaise(f.price), paidUntil: f.paidUntil || null },
                { success: "Seller created", onSuccess: (d) => { setOpen(false); router.push(`/provider/sellers/${d.id}`); } },
              );
            }}
          >
            <FormField label="Store name" className="sm:col-span-2"><Input value={f.storeName} onChange={set("storeName")} required /></FormField>
            <FormField label="Owner name"><Input value={f.ownerName} onChange={set("ownerName")} required /></FormField>
            <FormField label="Phone" optional><Input value={f.phone} onChange={set("phone")} inputMode="tel" /></FormField>
            <FormField label="Login email (username)"><Input type="email" autoComplete="off" value={f.email} onChange={set("email")} required /></FormField>
            <FormField label="Password" description="At least 10 characters."><PasswordInput autoComplete="new-password" value={f.password} onChange={set("password")} required minLength={10} /></FormField>
            <FormField label="GSTIN" optional><Input value={f.taxId} onChange={set("taxId")} maxLength={15} /></FormField>
            <PlanPicker value={pl} onChange={setPl} />
            <FormField label="Price per month (₹)" optional><Input value={f.price} onChange={set("price")} inputMode="decimal" /></FormField>
            <FormField label="Paid until" optional description="Leave empty for no expiry."><Input type="date" value={f.paidUntil} onChange={set("paidUntil")} /></FormField>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="new-seller" disabled={pending}>{pending && <Spinner />} Create seller</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
