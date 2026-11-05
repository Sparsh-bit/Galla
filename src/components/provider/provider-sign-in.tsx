"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { providerSignIn } from "@/server/actions/provider";
import { FormField } from "@/components/app/form-field";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function ProviderSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await providerSignIn({ email, password });
          if (!r.ok) return setError(r.error);
          router.replace("/provider");
          router.refresh();
        });
      }}
    >
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight"><ShieldCheck className="size-6 text-brand-deep" /> Provider portal</h1>
        <p className="text-sm text-muted-foreground">Concilio Solutions staff only. Every action here is recorded.</p>
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <FormField label="Email"><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></FormField>
      <FormField label="Password"><PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></FormField>
      <Button type="submit" className="w-full" disabled={pending}>{pending && <Spinner />} Sign in</Button>
    </form>
  );
}
