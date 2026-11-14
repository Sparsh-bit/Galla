"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AI_MAX_ROWS, type AiRow } from "@/lib/ai-menu";
import { addMenuProducts, readMenuFile } from "@/server/actions/ai";
import { shrinkImage } from "@/lib/upload-image";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = AiRow & { key: string };

/** Photo or PDF of a menu / price list -> editable draft rows -> products. Cost price is optional (menus have none). */
export function MenuImport({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [result, setResult] = useState<{ created: number; failed: { row: number; message: string }[] } | null>(null);

  async function read(file: File | undefined) {
    if (!file) return;
    setBusy("reading");
    setResult(null);
    try {
      const body = new FormData();
      const blob = file.type.startsWith("image/") ? await shrinkImage(file) : file;
      body.set("file", new File([blob], file.name, { type: blob.type || file.type }));
      const r = await readMenuFile(body);
      if (!r.ok) return void toast.error(r.error);
      if (!r.data.rows.length) return void toast.error("No items found. Try a clearer, closer photo.");
      setRows(r.data.rows.map((x) => ({ ...x, key: crypto.randomUUID() })));
      setNote(r.data.note);
    } catch {
      toast.error("Couldn't read that file. Check the internet and try again.");
    } finally {
      setBusy(null);
      if (camera.current) camera.current.value = "";
      if (picker.current) picker.current.value = "";
    }
  }

  const setRow = (key: string, patch: Partial<AiRow>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  const missing = rows?.filter((r) => !r.price.trim() || !Number.isFinite(Number(r.price))).length ?? 0;

  async function save() {
    if (!rows?.length || missing) return;
    setBusy("saving");
    const r = await addMenuProducts({ rows: rows.map((r) => ({ name: r.name, variant: r.variant, category: r.category, unit: r.unit, price: r.price, cost: r.cost, tax_rate: r.tax_rate })) });
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    setResult({ created: r.data.created, failed: r.data.failed });
    toast.success(`${r.data.created} product${r.data.created === 1 ? "" : "s"} added`);
    if (!r.data.failed.length) {
      setRows(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {!enabled && (
        <Alert><AlertDescription>This feature needs to be switched on for your server. Please ask Concilio Solutions to enable the AI reader.</AlertDescription></Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>1. Give Galla the menu</CardTitle>
          <CardDescription>A photo of a printed or handwritten menu, a price list, or a PDF. It can be a restaurant menu with no cost prices: only the selling price is needed.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void read(e.target.files?.[0])} />
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(e) => void read(e.target.files?.[0])} />
          <Button size="lg" disabled={!enabled || !!busy} onClick={() => camera.current?.click()}><Camera /> Take a photo</Button>
          <Button size="lg" variant="outline" disabled={!enabled || !!busy} onClick={() => picker.current?.click()}><FileText /> Choose photo or PDF</Button>
          {busy === "reading" && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Reading the menu… this takes up to a minute.</p>}
        </CardContent>
      </Card>

      {rows && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> 2. Check the items ({rows.length})</CardTitle>
            <CardDescription>Fix any name or price, remove what you don&apos;t need. Cost price is optional; leave it empty for a menu.{note && <> <strong>Note:</strong> {note}</>}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead className="pl-4">Name</TableHead><TableHead>Portion</TableHead><TableHead>Category</TableHead><TableHead className="w-28">Price (₹)</TableHead><TableHead className="w-28">Cost (₹)</TableHead><TableHead className="w-12"><span className="sr-only">Remove</span></TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="min-w-44 pl-4"><Input aria-label="Name" value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} maxLength={200} /></TableCell>
                      <TableCell className="min-w-24"><Input aria-label="Portion" value={r.variant} onChange={(e) => setRow(r.key, { variant: e.target.value })} maxLength={120} placeholder="—" /></TableCell>
                      <TableCell className="min-w-32"><Input aria-label="Category" value={r.category} onChange={(e) => setRow(r.key, { category: e.target.value })} maxLength={80} placeholder="—" /></TableCell>
                      <TableCell><Input aria-label="Price" inputMode="decimal" value={r.price} onChange={(e) => setRow(r.key, { price: e.target.value.replace(/[^\d.]/g, "") })} aria-invalid={!r.price.trim() || undefined} className={!r.price.trim() ? "border-destructive" : ""} /></TableCell>
                      <TableCell><Input aria-label="Cost price (optional)" inputMode="decimal" value={r.cost} onChange={(e) => setRow(r.key, { cost: e.target.value.replace(/[^\d.]/g, "") })} placeholder="optional" /></TableCell>
                      <TableCell><Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.name}`} onClick={() => setRows((rs) => rs?.filter((x) => x.key !== r.key) ?? null)}><Trash2 /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {missing > 0 && <p role="alert" className="px-4 text-sm text-destructive sm:px-0">{missing} item{missing === 1 ? " has" : "s have"} no price yet. Fill it in or remove the row.</p>}
            <div className="flex flex-wrap items-center gap-3 px-4 sm:px-0">
              <Button size="lg" disabled={!!busy || missing > 0 || !rows.length || rows.length > AI_MAX_ROWS} onClick={() => void save()}>{busy === "saving" && <Spinner />} Add {rows.length} product{rows.length === 1 ? "" : "s"}</Button>
              <Button variant="ghost" onClick={() => { setRows(null); setResult(null); }}>Start again</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && result.failed.length > 0 && (
        <Alert variant="destructive"><AlertDescription>
          {result.created} added. These rows could not be added: {result.failed.slice(0, 8).map((f) => `row ${f.row - 1}: ${f.message}`).join("; ")}
        </AlertDescription></Alert>
      )}
    </div>
  );
}
