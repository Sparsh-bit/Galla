import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while the next screen loads, so clicking never feels stuck. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8" role="status" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
