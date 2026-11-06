"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearOfflinePages } from "@/components/offline/register-sw";
import { accountDeletionPreview, deleteAccountAction } from "@/server/actions/auth";
import type { DeletionPlan } from "@/server/services/account";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** Permanently deletes the signed-in account (same rules as the Android app and DELETE via the API). */
export function DeleteAccount() {
  const router = useRouter();
  const [plan, setPlan] = useState<DeletionPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function start() {
    setBusy(true);
    const r = await accountDeletionPreview();
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setPlan(r.data);
    setOpen(true);
  }

  async function remove() {
    setBusy(true);
    const r = await deleteAccountAction({ password, confirm });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    clearOfflinePages();
    toast.success("Your account has been deleted.");
    router.replace("/");
    router.refresh();
  }

  const deleting = plan?.businesses.filter((b) => b.action === "delete") ?? [];
  const leaving = plan?.businesses.filter((b) => b.action === "leave") ?? [];

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="size-4" /> Delete account</CardTitle>
        <CardDescription>Permanently delete your Galla account. Businesses where you are the only member are deleted with all their bills, stock and khata.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={start} disabled={busy}>{busy && !open && <Spinner />} Delete my account…</Button>
      </CardContent>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPassword(""); setConfirm(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>This can&apos;t be undone. Download any reports you need for GST records first.</DialogDescription>
          </DialogHeader>
          {plan?.blockers.length ? (
            <Alert variant="destructive"><AlertDescription>{plan.blockers.map((b) => <p key={b}>{b}</p>)}</AlertDescription></Alert>
          ) : (
            <div className="space-y-3 text-sm">
              {deleting.length > 0 && <p><b>Deleted with all data:</b> {deleting.map((b) => b.name).join(", ")}</p>}
              {leaving.length > 0 && <p><b>You will leave:</b> {leaving.map((b) => b.name).join(", ")} (their data stays with the other members)</p>}
              <PasswordInput aria-label="Password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              <Input aria-label="Type DELETE to confirm" placeholder="Type DELETE to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            {!plan?.blockers.length && (
              <Button variant="destructive" onClick={remove} disabled={busy || !password || confirm !== "DELETE"}>{busy && <Spinner />} Delete permanently</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
