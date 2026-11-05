"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SCAN_EVENT } from "@/components/scanner/use-scanner";
import { desktopApp, loadProfile, nav, portKey, saveProfile, usbKey, usePrinterProfile, type DesktopPrinter } from "./printer";

export interface ConnectedDevices {
  /** Printers installed on this computer (Galla desktop app only). */
  printers: DesktopPrinter[];
  /** USB devices and serial (COM) ports this app has been allowed to use and that are plugged in now. */
  usb: { key: string; name: string }[];
  serial: { key: string; name: string }[];
}
const NONE: ConnectedDevices = { printers: [], usb: [], serial: [] };

export async function listConnected(): Promise<ConnectedDevices> {
  const n = nav();
  const [printers, usb, serial] = await Promise.all([
    desktopApp()?.listPrinters().catch(() => []) ?? [],
    n.usb?.getDevices().catch(() => []) ?? [],
    n.serial?.getPorts().catch(() => []) ?? [],
  ]);
  return {
    printers,
    usb: usb.map((d) => ({ key: usbKey(d), name: d.productName || `USB device ${usbKey(d)}` })),
    serial: serial.map((p) => ({ key: portKey(p), name: `Serial port ${portKey(p)}` })),
  };
}

/** Live list of connected printers and scanners: refreshed on plug/unplug, window focus and every 15 s. */
export function useConnectedDevices() {
  const [devices, setDevices] = useState<ConnectedDevices>(NONE);
  useEffect(() => {
    let alive = true;
    const refresh = () => listConnected().then((d) => alive && setDevices(d));
    refresh();
    const n = nav();
    const timer = setInterval(refresh, 15_000);
    for (const t of [n.usb, n.serial]) {
      t?.addEventListener("connect", refresh);
      t?.addEventListener("disconnect", refresh);
    }
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      for (const t of [n.usb, n.serial]) {
        t?.removeEventListener("connect", refresh);
        t?.removeEventListener("disconnect", refresh);
      }
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return devices;
}

const AUTO_KEY = "galla.printer.autoSetup";

/**
 * Background device work for every signed-in screen:
 * - In the desktop app, the first time it runs, pick the computer's default printer for silent printing.
 * - Read a serial/COM-mode barcode scanner and hand its codes to the screens like a USB scanner.
 */
export function DeviceBridge() {
  const p = usePrinterProfile();

  useEffect(() => {
    const desk = desktopApp();
    if (!desk) return;
    try {
      if (localStorage.getItem(AUTO_KEY)) return;
    } catch {
      return;
    }
    desk.listPrinters().then((printers) => {
      const cur = loadProfile();
      const pick = printers.find((x) => x.isDefault) ?? printers[0];
      try {
        localStorage.setItem(AUTO_KEY, "1");
      } catch {}
      if (!pick || cur.transport !== "browser" || cur.systemPrinter) return;
      saveProfile({ ...cur, transport: "system", systemPrinter: pick.name });
      toast.success(`Printer ready: ${pick.displayName || pick.name}`, { description: "Bills print straight to it. Change it in Settings → Printer & scanner." });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!p.scannerPort || !nav().serial) return;
    let stop = false;
    let reader: ReadableStreamDefaultReader<string> | null = null;
    let close: (() => Promise<void>) | null = null;
    const start = async () => {
      if (stop || reader) return;
      const port = (await nav().serial!.getPorts()).find((x) => portKey(x) === p.scannerPort);
      if (!port) return; // not plugged in: the "connect" event below retries
      try {
        await port.open({ baudRate: p.scannerBaud || 9600 });
      } catch (e) {
        if ((e as DOMException).name !== "InvalidStateError") return;
      }
      close = () => port.close().catch(() => undefined);
      reader = port.readable!.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>).getReader();
      let buf = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done || stop) break;
          buf += value;
          const lines = buf.split(/\r\n|\r|\n/);
          buf = lines.pop() ?? "";
          for (const code of lines.map((l) => l.trim()).filter((l) => /^[\x20-\x7e]{1,64}$/.test(l))) window.dispatchEvent(new CustomEvent(SCAN_EVENT, { detail: code }));
        }
      } catch {
        // unplugged: wait for it to come back
      } finally {
        reader = null;
        await close?.();
      }
    };
    start();
    const onConnect = () => start();
    nav().serial!.addEventListener("connect", onConnect);
    return () => {
      stop = true;
      nav().serial?.removeEventListener("connect", onConnect);
      reader?.cancel().catch(() => undefined);
    };
  }, [p.scannerPort, p.scannerBaud]);

  return null;
}
