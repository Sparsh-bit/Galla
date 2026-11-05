import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo, PoweredBy } from "@/components/app/logo";
import { ProviderSignIn } from "@/components/provider/provider-sign-in";
import { loadProvider } from "@/server/services/provider";

export const metadata: Metadata = { title: "Provider portal", robots: { index: false, follow: false } };

export default async function ProviderSignInPage() {
  if (await loadProvider()) redirect("/provider");
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <Logo className="text-3xl" />
        <ProviderSignIn />
        <PoweredBy />
      </div>
    </div>
  );
}
