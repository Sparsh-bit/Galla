"use client";
import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A screen failed to load (usually a dropped connection): offer a retry instead of a blank page. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[screen]", error.digest ?? error.message);
  }, [error]);
  return (
    <div className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-4 text-center">
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Something didn&apos;t load</h1>
        <p className="text-sm text-muted-foreground">Check your internet connection and try again. Nothing you saved is lost.</p>
        <Button onClick={reset}><RotateCw /> Try again</Button>
        {error.digest && <p className="font-mono text-[10px] text-muted-foreground">Reference {error.digest}</p>}
      </div>
    </div>
  );
}
