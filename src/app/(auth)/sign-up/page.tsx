import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { safePath } from "@/lib/safe-path";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  if (env.DEMO_MODE === "true") redirect("/demo");
  const { next } = await searchParams;
  return <SignUpForm next={safePath(next) ?? "/onboarding"} />;
}
