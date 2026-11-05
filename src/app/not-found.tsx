import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 text-center">
      <div className="space-y-5">
        <Logo className="text-3xl" />
        <h1 className="text-3xl font-extrabold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="text-sm text-muted-foreground">The link may be old or mistyped.</p>
        <Button asChild><Link href="/dashboard">Go to your dashboard</Link></Button>
      </div>
    </div>
  );
}
