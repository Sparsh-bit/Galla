"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { startDemo } from "@/server/actions/demo";
import { FormField } from "@/components/app/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export function DemoForm() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", phone: "", email: "", business: "", city: "", message: "", website: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="mt-8 grid gap-4 rounded-3xl border border-border bg-card p-5 shadow-[0_30px_80px_-50px_rgba(3,32,72,0.4)] sm:grid-cols-2 sm:p-7"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        const r = await startDemo(f);
        if (r.ok) {
          router.replace(r.data.next);
          router.refresh();
        } else {
          setError(r.error);
          setPending(false);
        }
      }}
    >
      <FormField label="Your name"><Input value={f.name} onChange={set("name")} autoComplete="name" required /></FormField>
      <FormField label="Phone / WhatsApp"><Input value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" required /></FormField>
      <FormField label="Shop or business name" className="sm:col-span-2"><Input value={f.business} onChange={set("business")} autoComplete="organization" required /></FormField>
      <FormField label="Email" optional><Input type="email" value={f.email} onChange={set("email")} autoComplete="email" /></FormField>
      <FormField label="City" optional><Input value={f.city} onChange={set("city")} autoComplete="address-level2" /></FormField>
      <FormField label="What do you sell, or what do you need?" optional className="sm:col-span-2"><Textarea rows={2} value={f.message} onChange={set("message")} /></FormField>
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute left-[-9999px]"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label></div>
      {error && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" className="h-12 w-full rounded-full font-semibold" disabled={pending}>
          {pending ? <Spinner /> : null} Open the demo <ArrowRight className="ml-1 size-4" />
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">We only use your details to call you about Galla. Sample data only: nothing here is a real shop.</p>
      </div>
    </form>
  );
}
