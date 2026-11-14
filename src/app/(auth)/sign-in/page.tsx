import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { safePath } from "@/lib/safe-path";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (env.DEMO_MODE === "true") redirect("/demo"); // the demo site has no login
  const { next } = await searchParams;
  const safeNext = safePath(next) ?? "/dashboard";
  return <SignInForm next={safeNext} />;
}
