"use client";
import { useT } from "@/components/app/i18n-provider";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resendVerificationAction, signInAction } from "@/server/actions/auth";
import { FormField } from "@/components/app/form-field";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function SignInForm({ next }: { next: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    setPending(true);
    setError(null);
    const res = await signInAction({ email, password: String(form.get("password")) });
    setPending(false);
    if (!res.ok) {
      if (res.error === "UNVERIFIED") setUnverified(email);
      else setError(res.error);
      return;
    }
    if (res.data.twoFactor) {
      router.push(next === "/dashboard" ? "/two-factor" : `/two-factor?next=${encodeURIComponent(next)}`);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function resend() {
    if (!unverified) return;
    const r = await resendVerificationAction({ email: unverified });
    if (r.ok) toast.success("Verification email sent. Check your inbox.");
    else toast.error(r.error);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Welcome back")}</h1>
        <p className="text-sm text-muted-foreground">{t("Sign in to your Galla account.")}</p>
      </div>
      {unverified && (
        <Alert>
          <AlertDescription>
            Please verify your email first. We sent a link to <strong>{unverified}</strong>.{" "}
            <button type="button" onClick={resend} className="font-medium text-primary underline-offset-4 hover:underline">
              Resend link
            </button>
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <FormField label={t("Email")}>
            <Input name="email" type="email" autoComplete="email" required autoFocus />
          </FormField>
          <FormField label={t("Password")}>
            <PasswordInput name="password" autoComplete="current-password" required />
          </FormField>
          <div className="-mt-2 text-right">
            <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {t("Forgot password?")}
            </Link>
          </div>
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending && <Spinner />} {t("Sign in")}
          </Button>
        </FieldGroup>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t("New to Galla?")}{" "}
        <Link href="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("Create an account")}
        </Link>
      </p>
    </div>
  );
}
