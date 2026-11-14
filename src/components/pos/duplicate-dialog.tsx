"use client";
import type { VariantHit } from "@/server/services/products";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Shown when a scanned or typed product is already in the bill: add one more, or leave it. */
export function DuplicateDialog({ hit, qty, onAdd, onSkip }: { hit: VariantHit; qty: number; onAdd: () => void; onSkip: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onSkip()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Already added</DialogTitle>
          <DialogDescription>
            <strong>{hit.name}{hit.variantName ? ` · ${hit.variantName}` : ""}</strong> is already in this bill ({qty}). Add it again to increase the quantity?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={onSkip} autoFocus>No, keep {qty}</Button>
          <Button className="h-12 flex-1" onClick={onAdd}>Yes, add one more</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
