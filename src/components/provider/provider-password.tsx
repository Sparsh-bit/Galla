"use client";
import { useState } from "react";
import { changePasswordAction } from "@/server/actions/auth";
import { FormField } from "@/components/app/form-field";
import { useAction } from "@/components/app/use-action";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function ProviderPassword() {
  const [f, setF] = useState({ currentPassword: "", newPassword: "" });
  const { run, pending } = useAction(changePasswordAction);
  return (
    <form className="max-w-sm space-y-3" onSubmit={(e) => { e.preventDefault(); run(f, { success: "Password changed", onSuccess: () => setF({ currentPassword: "", newPassword: "" }) }); }}>
      <FormField label="Current password"><PasswordInput autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} required /></FormField>
      <FormField label="New password" description="At least 10 characters."><PasswordInput autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} minLength={10} required /></FormField>
      <Button type="submit" disabled={pending}>{pending && <Spinner />} Change password</Button>
    </form>
  );
}
