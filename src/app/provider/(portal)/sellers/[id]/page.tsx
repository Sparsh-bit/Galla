import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { FEATURES } from "@/lib/features";
import { formatMoney } from "@/lib/money";
import { AccessControls, PaymentForm, SubscriptionForm } from "@/components/provider/seller-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppError } from "@/server/context";
import { getSeller } from "@/server/services/provider";

const money = (p: number) => formatMoney(p, "INR", "en-IN");
const date = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function SellerPage({ params }: PageProps<"/provider/sellers/[id]">) {
  const { id } = await params;
  const s = await getSeller(id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const sub = s.subscription;
  return (
    <div className="space-y-6">
      <Link href="/provider" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Sellers</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{s.name}</h1>
        <Badge variant={sub.state === "active" ? "secondary" : "destructive"}>{sub.state === "active" ? "Active" : sub.state === "locked" ? "Locked" : "Expired"}</Badge>
        <span className="text-sm text-muted-foreground">Since {date(s.createdAt)} · paid until {date(sub.paidUntil)} · {sub.plan} plan</span>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Modules switched on">
        {sub.features.length === 0 && <Badge variant="outline">Core only</Badge>}
        {sub.features.map((f) => <Badge key={f} variant="secondary">{FEATURES[f].label}</Badge>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {Object.entries(s.counts).map(([k, v]) => (
          <Card key={k} className="p-5"><p className="text-sm capitalize text-muted-foreground">{k}</p><p className="text-2xl font-bold tabular-nums">{v}</p></Card>
        ))}
      </div>
      <Card className="py-0">
        <CardHeader className="pt-5"><CardTitle>Users</CardTitle></CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email (username)</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
          <TableBody>
            {s.members.map((m) => (
              <TableRow key={m.email}><TableCell>{m.name}</TableCell><TableCell>{m.email}</TableCell><TableCell className="capitalize">{m.role}</TableCell><TableCell>{date(m.joinedAt)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <div className="space-y-4">
        <SubscriptionForm orgId={s.id} sub={{ ...sub, paidUntil: sub.paidUntil ? new Date(sub.paidUntil).toISOString() : null }} />
        <PaymentForm orgId={s.id} />
      </div>
      <Card className="py-0">
        <CardHeader className="pt-5"><CardTitle>Payments</CardTitle></CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Months</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead>Recorded by</TableHead></TableRow></TableHeader>
            <TableBody>
              {sub.payments.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No payments recorded yet.</TableCell></TableRow>}
              {sub.payments.map((p, i) => (
                <TableRow key={i}><TableCell>{date(p.paidAt)}</TableCell><TableCell className="text-right tabular-nums">{money(p.amount ?? 0)}</TableCell><TableCell>{p.months}</TableCell><TableCell className="uppercase">{p.method}</TableCell><TableCell>{p.reference}</TableCell><TableCell className="text-xs text-muted-foreground">{p.recordedBy}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AccessControls orgId={s.id} name={s.name} locked={sub.status === "locked"} reason={sub.lockReason} />
    </div>
  );
}
