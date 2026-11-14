import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { Logo, PoweredBy } from "@/components/app/logo";
import { DemoForm } from "@/components/landing/demo-form";
import { auth } from "@/server/auth";
import { env } from "@/env";

export const metadata: Metadata = { title: "Try the Galla demo", description: "Tell us about your shop and try Galla right away with sample products. No login needed." };

export default async function DemoPage() {
  if (env.DEMO_MODE !== "true") notFound();
  if (await auth.api.getSession({ headers: await headers() })) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-8 sm:py-14">
      <Link href="/" aria-label="Galla home" className="w-fit"><Logo className="text-2xl" /></Link>
      <h1 className="mt-8 text-balance text-3xl font-extrabold tracking-[-0.04em] text-[#032048] sm:text-4xl">Try Galla with your own eyes.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Tell us a little about your shop. You go straight into a private demo with sample products: no login, no password. It resets after 24 hours, and we will call you to help you set up your real shop.</p>
      <DemoForm />
      <div className="mt-auto pt-10"><PoweredBy /></div>
    </main>
  );
}
