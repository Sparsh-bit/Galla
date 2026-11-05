import Link from "next/link";
import { Building2, CircleAlert, IndianRupee, Lock } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { SearchInput } from "@/components/app/list-controls";
import { NewSeller } from "@/components/provider/new-seller";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listSellers, recentAudit } from "@/server/services/provider";

const money = (p: number) => formatMoney(p, "INR", "en-IN");
const date = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const STATE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "secondary" },
  expired: { label: "Expired", variant: "destructive" },
  locked: { label: "Locked", variant: "destructive" },
};

export default async function ProviderHome({ searchParams }: PageProps<"/provider">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const [rows, log] = await Promise.all([listSellers(q), recentAudit(12)]);
  const active = rows.filter((r) => r.state === "active");
  const tiles = [
    { label: "Sellers", value: String(rows.length), icon: Building2 },
    { label: "Active", value: String(active.length), icon: CircleAlert },
    { label: "Locked or expired", value: String(rows.length - active.length), icon: Lock },
    { label: "Monthly revenue (active)", value: money(active.reduce((a, r) => a + r.priceMonthly, 0)), icon: IndianRupee },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Sellers</h1><p className="text-sm text-muted-foreground">Every business on Galla, its subscription and activity.</p></div>
        <NewSeller />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="geo-corner flex-row items-center justify-between gap-3 p-5">
            <div><p className="text-sm text-muted-foreground">{t.label}</p><p className="text-2xl font-bold tabular-nums">{t.value}</p></div>
            <t.icon className="size-5 text-brand-deep" />
          </Card>
        ))}
      </div>
      <SearchInput placeholder="Search store or owner email" />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Store</TableHead><TableHead>Owner</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Paid until</TableHead><TableHead className="text-right">Bills (30 d)</TableHead><TableHead className="text-right">Sales (30 d)</TableHead><TableHead>Last sale</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">{q ? "No seller matches that search." : "No sellers yet. Create the first one."}</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link href={`/provider/sellers/${r.id}`} className="font-semibold hover:underline">{r.name}</Link><div className="text-xs text-muted-foreground">{r.members} user{r.members === 1 ? "" : "s"} · {r.products} products</div></TableCell>
                <TableCell><div>{r.ownerName}</div><div className="text-xs text-muted-foreground">{r.ownerEmail}</div></TableCell>
                <TableCell>{r.plan}<div className="text-xs text-muted-foreground">{money(r.priceMonthly)}/month</div></TableCell>
                <TableCell><Badge variant={STATE[r.state].variant}>{STATE[r.state].label}</Badge></TableCell>
                <TableCell>{date(r.paidUntil)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.bills30}</TableCell>
                <TableCell className="text-right tabular-nums">{money(r.revenue30)}</TableCell>
                <TableCell>{date(r.lastSaleAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Recent provider activity</h2>
        <Card className="py-0">
          <ul className="divide-y text-sm">
            {log.length === 0 && <li className="p-4 text-muted-foreground">Nothing yet.</li>}
            {log.map((l) => (
              <li key={String(l._id)} className="flex flex-wrap gap-x-3 p-3">
                <span className="font-mono text-xs text-muted-foreground">{new Date(l.createdAt as unknown as string).toLocaleString("en-IN")}</span>
                <span className="font-medium">{l.action}</span>
                <span>{l.orgName}</span>
                <span className="text-muted-foreground">{l.detail}</span>
                <span className="ml-auto text-xs text-muted-foreground">{l.adminEmail}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
