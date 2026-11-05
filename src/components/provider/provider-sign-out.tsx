"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function ProviderSignOut() {
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" onClick={async () => { await authClient.signOut(); router.replace("/provider/sign-in"); router.refresh(); }}>
      <LogOut /> Sign out
    </Button>
  );
}
