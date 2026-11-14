"use client";
import { useEffect, useRef } from "react";
import { createScanDetector } from "@/lib/scan-detector";
import { useOrg } from "@/components/app/org-context";

/** Window event carrying a code read from a serial-mode scanner. */
export const SCAN_EVENT = "galla:scan";

const isEditable = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && !el.readOnly;

/** Remove scanner keystrokes that landed in a focused text box, keeping React state in sync. */
function stripFromInput(el: HTMLInputElement | HTMLTextAreaElement, code: string) {
  if (!el.value.endsWith(code)) return;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
  setter?.call(el, el.value.slice(0, -code.length));
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Listens for USB/Bluetooth keyboard-wedge scanners anywhere on the page.
 * Fields marked `data-scan-field` keep the scanned text (e.g. a barcode input) and never
 * submit their form on the scanner's Enter.
 */
export function useScanner(onScan: (code: string) => void, enabled = true) {
  const { scanner } = useOrg();
  const cb = useRef(onScan);
  useEffect(() => {
    cb.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    let target: Element | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const detector = createScanDetector({
      interKeyMs: scanner.interKeyMs,
      minLength: scanner.minLength,
      onScan: (code) => {
        const el = target;
        if (el?.closest("[data-scan-field]")) return;
        if (isEditable(el)) stripFromInput(el, code);
        cb.current(code);
      },
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      target = document.activeElement;
      clearTimeout(flushTimer);
      if (detector.handleKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key.length === 1) flushTimer = setTimeout(() => detector.flush(), scanner.interKeyMs * 3);
    };
    // Serial/COM-mode scanners are read by <DeviceBridge> and arrive as this event.
    // Like a keyboard scanner, a focused barcode field keeps the code instead of triggering a scan.
    const onSerial = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      const el = document.activeElement;
      if (isEditable(el) && el.closest("[data-scan-field]")) {
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set?.call(el, code);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      cb.current(code);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener(SCAN_EVENT, onSerial);
    return () => {
      clearTimeout(flushTimer);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(SCAN_EVENT, onSerial);
    };
  }, [enabled, scanner.interKeyMs, scanner.minLength]);
}

let audioCtx: AudioContext | null = null;
/**
 * Scanner-style beep: a loud square-wave tone like a shop barcode machine (two quick pulses for a
 * good read, one low buzz for "not found"), plus a vibration tick on phones.
 */
export function scanFeedback(ok = true) {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const pulse = (freq: number, start: number, len: number) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(0.7, t0 + start + 0.006);
      g.gain.setValueAtTime(0.7, t0 + start + len - 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + len);
      o.connect(g).connect(audioCtx!.destination);
      o.start(t0 + start);
      o.stop(t0 + start + len + 0.01);
    };
    if (ok) {
      pulse(2400, 0, 0.09);
      pulse(2900, 0.11, 0.11);
    } else pulse(300, 0, 0.35);
  } catch {}
  // Browsers reject vibration before the first user tap (and log an error), so check first.
  if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) navigator.vibrate?.(ok ? 40 : [60, 40, 60]);
}
