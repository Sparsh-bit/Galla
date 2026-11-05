"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CameraScanner } from "./camera-scanner";

/** "Scan with camera" button + dialog. The camera closes as soon as a barcode is read. */
export function CameraScanButton({ onScan, label = "Camera", variant = "outline" }: { onScan: (code: string) => void; label?: string; variant?: "outline" | "default" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const read = useRef(false); // one code per opening, even if the detector fires again before closing
  return (
    <>
      <Button type="button" variant={variant} onClick={() => { read.current = false; setOpen(true); }} aria-label="Scan with camera">
        <Camera /> <span className="hidden sm:inline">{label}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Scan barcode</DialogTitle>
            <DialogDescription>Hold the barcode inside the frame. The camera closes once it&apos;s read.</DialogDescription>
          </DialogHeader>
          {open && (
            <CameraScanner
              className="aspect-video w-full"
              onScan={(code) => {
                if (read.current) return;
                read.current = true;
                setOpen(false);
                onScan(code);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
