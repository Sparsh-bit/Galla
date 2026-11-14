"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CameraScanner } from "./camera-scanner";

/** "Scan with camera" button + dialog. The camera closes as soon as a barcode is read. */
export function CameraScanButton({ onScan, label = "Camera", variant = "outline", continuous = false }: { onScan: (code: string) => void | string | Promise<void | string>; label?: string; variant?: "outline" | "default" | "secondary"; continuous?: boolean }) {
  const [open, setOpen] = useState(false);
  const read = useRef(false); // one code per opening, even if the detector fires again before closing
  const [last, setLast] = useState("");
  return (
    <>
      <Button type="button" variant={variant} onClick={() => { read.current = false; setLast(""); setOpen(true); }} aria-label="Scan with camera">
        <Camera /> <span className="hidden sm:inline">{label}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Scan barcode</DialogTitle>
            <DialogDescription>{continuous ? "Hold each barcode inside the frame. The camera stays open so you can scan the next item. Tap Done when finished." : "Hold the barcode inside the frame. The camera closes once it's read."}</DialogDescription>
          </DialogHeader>
          {open && (
            <CameraScanner
              className="aspect-video w-full"
              onScan={async (code) => {
                if (continuous) {
                  const msg = await onScan(code);
                  if (typeof msg === "string") setLast(msg);
                  return;
                }
                if (read.current) return;
                read.current = true;
                setOpen(false);
                onScan(code);
              }}
            />
          )}
          {continuous && open && (
            <div className="flex items-center justify-between gap-3">
              <p role="status" aria-live="polite" className="min-h-6 min-w-0 flex-1 truncate text-sm font-medium">{last || "Waiting for a barcode…"}</p>
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
