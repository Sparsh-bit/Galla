import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Logo, PoweredBy } from "@/components/app/logo";
import { env } from "@/env";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Subscription expired" };

/** Shown when every business this person belongs to is locked or past its paid date. */
export default function LockedPage() {
  if (env.DEMO_MODE === "true") {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4 text-center">
        <div className="max-w-md space-y-5">
          <Logo className="text-3xl justify-center" />
          <h1 className="text-3xl font-extrabold tracking-tight">Your demo has ended</h1>
          <p className="text-sm text-muted-foreground">Demos last 24 hours. Start a new one any time, or talk to us about your real shop.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <a href="/demo" className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Start a new demo</a>
            <a href="mailto:team@concilio.solutions" className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-semibold">Contact Concilio Solutions</a>
          </div>
          <div className="pt-4"><PoweredBy /></div>
        </div>
      </div>
    );
  }
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 text-center">
      <div className="max-w-md space-y-5">
        <Logo className="text-3xl justify-center" />
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive"><Lock className="size-6" /></span>
        <h1 className="text-3xl font-extrabold tracking-tight">Your subscription has expired</h1>
        <p className="text-sm text-muted-foreground">This Galla account is locked, so billing and stock are paused on every device. Your data is safe. Contact Concilio Solutions to renew and it unlocks straight away.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <a href="mailto:team@concilio.solutions" className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Contact Concilio Solutions</a>
          <SignOutButton />
        </div>
        <div className="pt-4"><PoweredBy /></div>
      </div>
    </div>
  );
}
