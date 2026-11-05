"use client";
import { useState } from "react";
import { Bluetooth, Cable, Laptop, Plug, CheckCircle2, Globe, MonitorSmartphone, Printer, ScanBarcode, Usb } from "lucide-react";
import { toast } from "sonner";
import { EscPos } from "@/lib/escpos";
import { useOrg } from "@/components/app/org-context";
import { kickDrawer } from "@/components/print/use-print-sale";
import { desktopApp, nav, pairPrinter, portKey, saveProfile, sendRaw, usePrinterProfile, usePrinterSupport, type PrinterProfile, type Transport } from "@/components/print/printer";
import { useConnectedDevices } from "@/components/print/device-bridge";
import { CameraScanButton } from "@/components/scanner/scan-tools";
import { useScanner } from "@/components/scanner/use-scanner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const SYSTEM = { id: "system" as Transport, label: "Installed printer (silent)", icon: Laptop, text: "Galla desktop app: prints straight to any printer installed on this computer (laser, inkjet, label or thermal) with no dialog." };
const TRANSPORTS: { id: Transport; label: string; icon: typeof Printer; text: string }[] = [
  { id: "browser", label: "Any printer", icon: Globe, text: "Uses the system print dialog. Works with every installed printer (thermal or A4), in every browser." },
  { id: "usb", label: "USB (direct)", icon: Usb, text: "Silent printing to a USB thermal printer. Chrome/Edge on desktop or Android." },
  { id: "serial", label: "Serial / COM", icon: Cable, text: "For printers that appear as a COM / serial port (most Windows USB thermal printers with a driver)." },
  { id: "bluetooth", label: "Bluetooth", icon: Bluetooth, text: "Portable BLE receipt printers. Chrome on Android, Windows, macOS." },
  { id: "bridge", label: "Network (LAN)", icon: MonitorSmartphone, text: "Ethernet/Wi-Fi printers via the Galla print bridge running on a shop PC." },
];

export function DeviceSettings() {
  const org = useOrg();
  const p = usePrinterProfile();
  const caps = usePrinterSupport();
  const [lastScan, setLastScan] = useState<string | null>(null);
  useScanner((code) => setLastScan(code));

  const update = (patch: Partial<PrinterProfile>) => saveProfile({ ...p, ...patch });

  async function pair() {
    try {
      const r = await pairPrinter(p.transport);
      update({ deviceKey: r.deviceKey, deviceName: r.deviceName });
      toast.success(r.message);
    } catch (e) {
      if ((e as DOMException).name !== "NotFoundError") toast.error((e as Error).message || "Could not connect");
    }
  }

  async function testPrint() {
    if (p.transport === "system") {
      if (!p.systemPrinter) return toast.error("Choose a printer first.");
      try {
        await desktopApp()!.printHtml(`<body style="font:14px sans-serif;text-align:center"><h2>${org.orgName.replace(/[<>&]/g, "")}</h2><p>Printer test</p><p>Paper: ${p.width} mm</p><p>If you can read this, printing works!</p></body>`, { printer: p.systemPrinter, width: p.width });
        toast.success("Test page sent");
      } catch (err) {
        toast.error((err as Error).message);
      }
      return;
    }
    if (p.transport === "browser") return toast.info("Complete a sale and use “Receipt”, or open any sale and click Receipt to test browser printing.");
    const e = new EscPos({ width: p.width === 58 ? 32 : 48 }).init().align("center").bold(true).size(2, 2).line(org.orgName.slice(0, 16)).size(1, 1).bold(false)
      .line("Printer test").divider().align("left").cols("Paper width", `${p.width} mm`).cols("Connection", p.transport).cols("Rs. symbol", "₹ -> Rs.").divider()
      .align("center").qr("https://galla.app", 5).line("If you can read this, printing works!").feed(3).cut();
    try {
      await sendRaw(p, e.bytes());
      toast.success("Test page sent");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const devices = useConnectedDevices();
  const printers = devices.printers;

  async function connectSerialScanner() {
    try {
      const port = await nav().serial!.requestPort();
      update({ scannerPort: portKey(port) });
      toast.success("Serial scanner connected. Scan a barcode to test.");
    } catch (e) {
      if ((e as DOMException).name !== "NotFoundError") toast.error((e as Error).message || "Could not connect");
    }
  }
  const options = caps.desktop ? [SYSTEM, ...TRANSPORTS] : TRANSPORTS;

  const unsupported = p.transport !== "browser" && p.transport !== "bridge" && !(p.transport === "system" ? caps.desktop : caps[p.transport]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plug className="size-4" /> Connected devices</CardTitle>
          <CardDescription>What this computer can use right now. The list updates when you plug a device in or out.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-lg border" aria-label="Connected devices">
            {printers.map((x) => {
              const inUse = p.transport === "system" && p.systemPrinter === x.name;
              return (
                <li key={x.name} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Printer className="size-4 shrink-0 text-brand-deep" />
                  <span className="min-w-0 flex-1 truncate">{x.displayName || x.name}{x.isDefault && <span className="ml-2 text-xs text-muted-foreground">system default</span>}</span>
                  {inUse ? <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" /> In use</span> : <Button size="sm" variant="outline" onClick={() => update({ transport: "system", systemPrinter: x.name })}>Use for bills</Button>}
                </li>
              );
            })}
            {devices.usb.map((d) => (
              <li key={`usb-${d.key}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Usb className="size-4 shrink-0 text-brand-deep" />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                {p.transport === "usb" && p.deviceKey === d.key ? <span className="text-xs font-medium text-success">Receipt printer</span> : <Button size="sm" variant="outline" onClick={() => update({ transport: "usb", deviceKey: d.key, deviceName: d.name })}>Use as printer</Button>}
              </li>
            ))}
            {devices.serial.map((d) => (
              <li key={`serial-${d.key}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Cable className="size-4 shrink-0 text-brand-deep" />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <span className="text-xs text-muted-foreground">{p.scannerPort === d.key ? "Barcode scanner" : p.transport === "serial" && p.deviceKey === d.key ? "Receipt printer" : "Available"}</span>
              </li>
            ))}
            <li className="flex items-center gap-3 px-4 py-3 text-sm">
              <ScanBarcode className="size-4 shrink-0 text-brand-deep" />
              <span className="min-w-0 flex-1">USB / Bluetooth barcode scanner</span>
              <span className={`text-xs font-medium ${lastScan ? "text-success" : "text-muted-foreground"}`}>{lastScan ? "Working" : "Detected on its first scan"}</span>
            </li>
            {!printers.length && !devices.usb.length && !devices.serial.length && (
              <li className="px-4 py-3 text-xs text-muted-foreground">{caps.desktop ? "No printers installed yet. Add one in your computer's printer settings; it appears here automatically." : "Install the Galla desktop app to see every printer on this computer, or connect a USB / serial / Bluetooth printer below."}</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Printer className="size-4" /> Receipt printer</CardTitle>
          <CardDescription>How this device prints bills.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((t) => (
              <button key={t.id} type="button" onClick={() => update({ transport: t.id })} aria-pressed={p.transport === t.id} className={`flex gap-3 rounded-lg border p-3 text-left transition ${p.transport === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                <t.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span><span className="block text-sm font-medium">{t.label}</span><span className="block text-xs text-muted-foreground">{t.text}</span></span>
              </button>
            ))}
          </div>
          {unsupported && (
            <Alert variant="destructive"><AlertDescription>This browser can&apos;t talk to {p.transport} printers. Use Chrome or Edge, or choose “Any printer”.</AlertDescription></Alert>
          )}
          {p.transport === "system" && (
            <div className="max-w-sm space-y-1.5">
              <Label htmlFor="sys-printer">Printer</Label>
              <select id="sys-printer" value={p.systemPrinter} onChange={(e) => update({ systemPrinter: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Choose a printer…</option>
                {printers.map((x) => <option key={x.name} value={x.name}>{x.displayName || x.name}{x.isDefault ? " (default)" : ""}</option>)}
              </select>
              {!printers.length && <p className="text-xs text-muted-foreground">No printers found. Install the printer driver in your system settings, then reopen this page.</p>}
            </div>
          )}
          {p.transport === "bridge" && (
            <div className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="br-url">Bridge address</Label><Input id="br-url" value={p.bridgeUrl} onChange={(e) => update({ bridgeUrl: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="br-key">Bridge key</Label><Input id="br-key" type="password" value={p.bridgeKey} onChange={(e) => update({ bridgeKey: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground sm:col-span-2">Run <code className="rounded bg-background px-1">node print-bridge/bridge.mjs --printer 192.168.1.50 --key YOUR-KEY</code> on this computer (the bridge address stays http://127.0.0.1:9123). See print-bridge/README.md.</p>
            </div>
          )}
          {p.transport === "serial" && (
            <div className="max-w-48 space-y-1.5"><Label htmlFor="baud">Baud rate</Label><Input id="baud" inputMode="numeric" value={p.baudRate} onChange={(e) => update({ baudRate: Number(e.target.value.replace(/\D/g, "")) || 9600 })} /></div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <ToggleGroup type="single" variant="outline" value={String(p.width)} onValueChange={(v) => v && update({ width: Number(v) as 58 | 80 })} aria-label="Paper width">
              <ToggleGroupItem value="58" className="px-4">58 mm</ToggleGroupItem>
              <ToggleGroupItem value="80" className="px-4">80 mm</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="single" variant="outline" value={p.invoiceFormat} onValueChange={(v) => v && update({ invoiceFormat: v as "thermal" })} aria-label="Default bill format">
              <ToggleGroupItem value="thermal" className="px-4">Thermal receipt</ToggleGroupItem>
              <ToggleGroupItem value="a4" className="px-4">A4 invoice</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><Label htmlFor="auto" className="font-normal">Print automatically after each sale</Label><Switch id="auto" checked={p.autoPrint} onCheckedChange={(v) => update({ autoPrint: v })} /></div>
            <div className="flex items-center justify-between"><Label htmlFor="drawer" className="flex flex-col items-start gap-0.5 font-normal">Open cash drawer on cash sales<span className="text-xs text-muted-foreground">Drawer must be plugged into the printer (direct connections only).</span></Label><Switch id="drawer" checked={p.openDrawer} onCheckedChange={(v) => update({ openDrawer: v })} disabled={p.transport === "browser" || p.transport === "system"} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["usb", "serial", "bluetooth"].includes(p.transport) && <Button variant="outline" onClick={pair} disabled={unsupported}>Connect printer…</Button>}
            {p.deviceName && ["usb", "serial", "bluetooth"].includes(p.transport) && <span className="self-center text-xs text-muted-foreground">Using: {p.deviceName}</span>}
            <Button variant="outline" onClick={testPrint}>Print test page</Button>
            {p.transport !== "browser" && p.transport !== "system" && <Button variant="outline" onClick={() => kickDrawer()}>Open drawer</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ScanBarcode className="size-4" /> Barcode scanner</CardTitle>
          <CardDescription>USB and Bluetooth scanners work automatically — no setup needed. Scan any barcode now to test.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-center gap-3 rounded-lg border p-4 ${lastScan ? "border-success bg-success/5" : "border-dashed"}`} aria-live="polite">
            {lastScan ? <CheckCircle2 className="size-5 text-success" /> : <ScanBarcode className="size-5 text-muted-foreground" />}
            <span className="text-sm">{lastScan ? <>Scanner works. Read: <code className="font-mono font-semibold">{lastScan}</code></> : "Waiting for a scan…"}</span>
          </div>
          {caps.serial && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3">
              <span className="flex-1 text-xs text-muted-foreground">Scanner set to <b>serial / COM</b> mode (it doesn&apos;t type like a keyboard)? Connect it here and scans work everywhere in Galla.</span>
              {p.scannerPort ? (
                <Button size="sm" variant="outline" onClick={() => update({ scannerPort: "" })}>Disconnect serial scanner</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={connectSerialScanner}>Connect serial scanner…</Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <CameraScanButton onScan={(c) => setLastScan(c)} label="Test camera" />
            <p className="text-xs text-muted-foreground">No scanner? The phone or laptop camera works too, and on the POS you can pair a phone as a wireless scanner.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
