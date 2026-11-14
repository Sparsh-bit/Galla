"use client";
import { useState } from "react";
import Link from "next/link";
import { ClipboardCopy, MessageCircle, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { reorderMessage, type ReorderGroup } from "@/lib/reorder";
import { waLink } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";

/** One card per supplier: edit the quantities, then send the list on WhatsApp or copy it. */
export function ReorderLists({ groups, shop, countryCode }: { groups: ReorderGroup[]; shop: string; countryCode: string; canBuy: boolean }) {
  if (!groups.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><PackageCheck /></EmptyMedia>
          <EmptyTitle>Nothing to reorder</EmptyTitle>
          <EmptyDescription>Every product is above its reorder level. Set a reorder level on a product to be reminded here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return <div className="space-y-4">{groups.map((g) => <Group key={g.supplierId ?? "none"} g={g} shop={shop} countryCode={countryCode} />)}</div>;
}

function Group({ g, shop, countryCode }: { g: ReorderGroup; shop: string; countryCode: string }) {
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(g.items.map((i) => [i.variantId, String(i.suggest)])));
  const [off, setOff] = useState<Set<string>>(new Set());
  const items = g.items.filter((i) => !off.has(i.variantId)).map((i) => ({ name: i.name, unit: i.unit, qty: Number(qty[i.variantId]) || 0 }));
  const message = reorderMessage(shop, g.supplierId ? g.supplierName : "", items);
  const link = items.length ? (g.phone ? waLink(g.phone, message, countryCode) : null) ?? `https://wa.me/?text=${encodeURIComponent(message)}` : null;
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">{g.supplierName}{!g.supplierId && <Badge variant="outline">add a purchase to link a supplier</Badge>}</CardTitle>
        <span className="text-sm text-muted-foreground">{g.items.length} item{g.items.length === 1 ? "" : "s"}</span>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y rounded-lg border">
          {g.items.map((i) => (
            <li key={i.variantId} className="flex flex-wrap items-center gap-3 p-3">
              <input type="checkbox" className="size-4" checked={!off.has(i.variantId)} onChange={(e) => setOff((s) => { const n = new Set(s); if (e.target.checked) n.delete(i.variantId); else n.add(i.variantId); return n; })} aria-label={`Include ${i.name}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.name}</p>
                <p className="text-xs text-muted-foreground">In stock: {i.inStock} {i.unit}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="sr-only">Order quantity for {i.name}</span>
                <Input inputMode="decimal" className="h-9 w-24 text-right tabular-nums" value={qty[i.variantId]} onChange={(e) => setQty((q) => ({ ...q, [i.variantId]: e.target.value.replace(/[^\d.]/g, "") }))} disabled={off.has(i.variantId)} />
                <span className="w-10 text-muted-foreground">{i.unit}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button asChild disabled={!link}>
            <a href={link ?? "#"} target="_blank" rel="noopener noreferrer" aria-disabled={!link}><MessageCircle /> {g.phone ? "Send on WhatsApp" : "Share on WhatsApp"}</a>
          </Button>
          <Button variant="outline" disabled={!items.length} onClick={() => navigator.clipboard.writeText(message).then(() => toast.success("List copied"), () => toast.error("Couldn't copy"))}><ClipboardCopy /> Copy list</Button>
          {g.supplierId && <Button asChild variant="ghost"><Link href="/purchases/new">New purchase order</Link></Button>}
        </div>
        {g.supplierId && !g.phone && <p className="text-xs text-muted-foreground">No phone number saved for {g.supplierName}: WhatsApp opens so you can pick the contact.</p>}
      </CardContent>
    </Card>
  );
}
