"use client";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
// Per-device printer setup. Lives in localStorage because each counter PC/phone has its own printer.

export type Transport = "browser" | "system" | "serial" | "usb" | "bluetooth" | "bridge";

export interface PrinterProfile {
  transport: Transport;
  width: 58 | 80;
  baudRate: number;
  bridgeUrl: string;
  bridgeKey: string;
  autoPrint: boolean;
  openDrawer: boolean;
  invoiceFormat: "thermal" | "a4";
  /** Galla desktop only: OS printer name used by the "system" transport. */
  systemPrinter: string;
  /** Which paired USB/serial/Bluetooth device to use (vendor:product or BLE id), and its label. */
  deviceKey: string;
  deviceName: string;
  /** A barcode scanner set to serial/COM mode (vendor:product of its port), read directly; "" = none. */
  scannerPort: string;
  scannerBaud: number;
}

const KEY = "stockpilot.printer";
export const DEFAULT_PROFILE: PrinterProfile = { transport: "browser", width: 80, baudRate: 9600, bridgeUrl: "http://127.0.0.1:9123", bridgeKey: "", autoPrint: true, openDrawer: false, invoiceFormat: "thermal", systemPrinter: "", deviceKey: "", deviceName: "", scannerPort: "", scannerBaud: 9600 };

export function loadProfile(): PrinterProfile {
  try {
    return { ...DEFAULT_PROFILE, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<PrinterProfile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

const listeners = new Set<() => void>();
let cache: { raw: string | null; profile: PrinterProfile } | null = null;

function snapshot(): PrinterProfile {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (!cache || cache.raw !== raw) cache = { raw, profile: loadProfile() };
  return cache.profile;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function saveProfile(p: PrinterProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
  listeners.forEach((l) => l());
}

/** This device's printer profile, kept in sync across components and tabs. */
export function usePrinterProfile(): PrinterProfile {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PROFILE);
}

export interface DesktopPrinter { name: string; displayName: string; isDefault: boolean }
export interface GallaDesktop {
  platform: string;
  version: string;
  listPrinters(): Promise<DesktopPrinter[]>;
  printUrl(url: string, o: { printer: string; width: number }): Promise<void>;
  printHtml(html: string, o: { printer: string; width: number }): Promise<void>;
}
/** The Galla desktop shell (Electron) injects this; it is absent in a normal browser. */
export const desktopApp = (): GallaDesktop | null => (typeof window === "undefined" ? null : ((window as unknown as { gallaDesktop?: GallaDesktop }).gallaDesktop ?? null));

const NO_SUPPORT = { serial: false, usb: false, bluetooth: false, desktop: false };
let capsCache: typeof NO_SUPPORT | null = null;
/** Which direct-printing browser APIs exist here (stable object for useSyncExternalStore). */
export function usePrinterSupport() {
  return useSyncExternalStore(
    () => () => undefined,
    () => (capsCache ??= supports()),
    () => NO_SUPPORT,
  );
}

export const supports = () => ({
  serial: typeof navigator !== "undefined" && "serial" in navigator,
  usb: typeof navigator !== "undefined" && "usb" in navigator,
  bluetooth: typeof navigator !== "undefined" && "bluetooth" in navigator,
  desktop: !!desktopApp(),
});

/* ----- minimal Web Serial / WebUSB / Web Bluetooth typings (not in lib.dom yet) ----- */
export interface SerialPortLike { getInfo(): { usbVendorId?: number; usbProductId?: number }; open(o: { baudRate: number }): Promise<void>; close(): Promise<void>; writable: WritableStream<Uint8Array> | null; readable: ReadableStream<Uint8Array> | null }
interface USBEndpointLike { direction: "in" | "out"; type: string; endpointNumber: number }
export interface USBDeviceLike {
  vendorId: number; productId: number; productName?: string;
  opened: boolean; configuration: { interfaces: { interfaceNumber: number; alternate: { endpoints: USBEndpointLike[] } }[] } | null;
  open(): Promise<void>; selectConfiguration(n: number): Promise<void>; claimInterface(n: number): Promise<void>; transferOut(ep: number, data: Uint8Array): Promise<unknown>;
}
interface BTCharLike { properties: { write: boolean; writeWithoutResponse: boolean }; writeValueWithoutResponse?(d: Uint8Array): Promise<void>; writeValue(d: Uint8Array): Promise<void> }
interface BTDeviceLike { id: string; name?: string; gatt?: { connect(): Promise<{ getPrimaryServices(): Promise<{ getCharacteristics(): Promise<BTCharLike[]> }[]> }> } }
type Nav = Navigator & {
  serial?: EventTarget & { requestPort(): Promise<SerialPortLike>; getPorts(): Promise<SerialPortLike[]> };
  usb?: EventTarget & { requestDevice(o: { filters: object[] }): Promise<USBDeviceLike>; getDevices(): Promise<USBDeviceLike[]> };
  bluetooth?: { requestDevice(o: object): Promise<BTDeviceLike>; getDevices?(): Promise<BTDeviceLike[]> };
};
export const nav = () => navigator as Nav;

// Common BLE thermal printer services (generic "18F0", Xprinter/Goojprt and others).
const BLE_SERVICES = ["000018f0-0000-1000-8000-00805f9b34fb", "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "49535343-fe7d-4ae5-8fa9-9fafd205e455", "0000ff00-0000-1000-8000-00805f9b34fb"];

let btChar: BTCharLike | null = null;

const hex = (n: number | undefined) => (n ?? 0).toString(16).padStart(4, "0");
export const portKey = (p: SerialPortLike) => `${hex(p.getInfo().usbVendorId)}:${hex(p.getInfo().usbProductId)}`;
export const usbKey = (d: USBDeviceLike) => `${hex(d.vendorId)}:${hex(d.productId)}`;
/** The paired device the profile points at; falls back to the only/first one. */
const chosen = <T,>(list: T[] | undefined, key: string, keyOf: (x: T) => string): T | undefined => list?.find((x) => keyOf(x) === key) ?? list?.[0];

/** Ask the user to choose a device (must run from a click). Returns what to remember about it. */
export async function pairPrinter(t: Transport): Promise<{ message: string; deviceKey: string; deviceName: string }> {
  if (t === "serial") {
    const port = await nav().serial!.requestPort();
    const key = portKey(port);
    return { message: "Printer port selected", deviceKey: key, deviceName: `Serial device ${key}` };
  }
  if (t === "usb") {
    const dev = await nav().usb!.requestDevice({ filters: [] });
    return { message: "USB printer selected", deviceKey: usbKey(dev), deviceName: dev.productName || `USB device ${usbKey(dev)}` };
  }
  if (t === "bluetooth") {
    const dev = await nav().bluetooth!.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
    btChar = await findBtCharacteristic(dev);
    return { message: "Bluetooth printer connected", deviceKey: dev.id, deviceName: dev.name || "Bluetooth printer" };
  }
  return { message: "Ready", deviceKey: "", deviceName: "" };
}

async function findBtCharacteristic(dev: BTDeviceLike) {
  const server = await dev.gatt!.connect();
  for (const svc of await server.getPrimaryServices()) {
    for (const c of await svc.getCharacteristics()) if (c.properties.write || c.properties.writeWithoutResponse) return c;
  }
  throw new Error("This Bluetooth device has no printable channel");
}

/** Browsers forget Bluetooth printers on reload; reconnect to the remembered one where the browser allows it. */
async function reconnectBluetooth(key: string) {
  const dev = (await nav().bluetooth?.getDevices?.())?.find((d) => d.id === key);
  if (dev) btChar = await findBtCharacteristic(dev).catch(() => null);
}

/** Sends raw ESC/POS bytes. Throws with a human message on failure. */
export async function sendRaw(p: PrinterProfile, data: Uint8Array) {
  if (p.transport === "serial") {
    const port = chosen(await nav().serial?.getPorts(), p.deviceKey, portKey);
    if (!port) throw new Error("No printer paired. Open Settings → Printer & scanner.");
    await port.open({ baudRate: p.baudRate }).catch((e: DOMException) => {
      if (e.name !== "InvalidStateError") throw e; // already open
    });
    const writer = port.writable!.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
      await port.close().catch(() => undefined);
    }
    return;
  }
  if (p.transport === "usb") {
    const dev = chosen(await nav().usb?.getDevices(), p.deviceKey, usbKey);
    if (!dev) throw new Error("No USB printer paired. Open Settings → Printer & scanner.");
    if (!dev.opened) await dev.open();
    if (!dev.configuration) await dev.selectConfiguration(1);
    const iface = dev.configuration!.interfaces.find((i) => i.alternate.endpoints.some((e) => e.direction === "out" && e.type === "bulk"));
    if (!iface) throw new Error("This USB device doesn't look like a printer");
    await dev.claimInterface(iface.interfaceNumber).catch(() => undefined);
    const ep = iface.alternate.endpoints.find((e) => e.direction === "out" && e.type === "bulk")!;
    for (let i = 0; i < data.length; i += 4096) await dev.transferOut(ep.endpointNumber, data.slice(i, i + 4096));
    return;
  }
  if (p.transport === "bluetooth") {
    if (!btChar && p.deviceKey) await reconnectBluetooth(p.deviceKey);
    if (!btChar) throw new Error("Reconnect the Bluetooth printer in Settings → Printer & scanner (browsers forget it on reload).");
    const ch = btChar;
    try {
      for (let i = 0; i < data.length; i += 180) {
        const chunk = data.slice(i, i + 180);
        if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(chunk);
        else await ch.writeValue(chunk);
      }
    } catch (e) {
      btChar = null; // printer went to sleep or out of range: reconnect on the next print
      throw new Error(`Bluetooth printer not reachable (${(e as Error).message}). Switch it on and try again.`);
    }
    return;
  }
  if (p.transport === "bridge") {
    const res = await fetch(`${p.bridgeUrl.replace(/\/$/, "")}/print`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Bridge-Key": p.bridgeKey }, body: data as BodyInit });
    if (!res.ok) throw new Error(`Print bridge error: ${await res.text().catch(() => res.status)}`);
    return;
  }
  throw new Error("This printer mode prints pages, not raw receipt data. Choose USB, Serial, Bluetooth or Network for the cash drawer.");
}

/** Prints a page (receipt/invoice): silently to the chosen OS printer in the Galla desktop app, else the browser print dialog. */
export function browserPrint(url: string) {
  const p = loadProfile();
  const desk = desktopApp();
  if (desk && p.transport === "system" && p.systemPrinter) {
    const quiet = url.replace(/([?&])auto=1&?/, "$1").replace(/[?&]$/, "");
    desk.printUrl(quiet, { printer: p.systemPrinter, width: p.width }).catch((e: Error) => toast.error(e.message || "Printer not reachable"));
    return;
  }
  const old = document.getElementById("print-frame");
  old?.remove();
  const f = document.createElement("iframe");
  f.id = "print-frame";
  f.title = "Print";
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  f.src = url;
  document.body.appendChild(f);
}
