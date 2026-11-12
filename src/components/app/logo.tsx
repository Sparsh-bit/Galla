import { cn } from "@/lib/utils";

/**
 * Galla app icon:
 * A proud storefront canopy awning in merchant emerald green (#047348),
 * a deep navy blue capital G body (#032048),
 * and a billing receipt with three ledger lines in the inner crook.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 114"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <defs>
        <linearGradient id="galla-green-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#058252" />
          <stop offset="100%" stopColor="#047348" />
        </linearGradient>
        <linearGradient id="galla-navy-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#062b5d" />
          <stop offset="100%" stopColor="#032048" />
        </linearGradient>
      </defs>

      {/* Vector silhouette fallback */}
      <g>
        {/* Scalloped storefront awning in emerald green */}
        <path
          d="M 23 2 L 77 2 L 95 27 C 94 32 85 33 82 29 C 78 33 69 33 66 29 C 62 33 53 33 50 29 C 46 33 37 33 34 29 C 31 33 22 33 19 29 C 16 33 7 32 5 27 Z"
          fill="url(#galla-green-grad)"
        />
        {/* Navy G body */}
        <path
          d="M 44 28 C 22 28 8 44 8 68 C 8 93 24 112 50 112 C 72 112 88 98 92 78 L 92 48 L 52 48 L 52 64 L 75 64 C 74 74 65 82 51 82 C 34 82 25 72 25 58 C 25 43 35 34 49 34 L 54 34 Z"
          fill="url(#galla-navy-grad)"
        />
        {/* Billing receipt document */}
        <rect x="52" y="52" width="28" height="34" rx="4" fill="url(#galla-green-grad)" />
        <rect x="57" y="59" width="18" height="2.8" rx="1.4" fill="#ffffff" />
        <rect x="57" y="66" width="18" height="2.8" rx="1.4" fill="#ffffff" />
        <rect x="57" y="73" width="13" height="2.8" rx="1.4" fill="#ffffff" />
      </g>

      {/* High-resolution raster overlay for 1:1 authentic reproduction */}
      <image
        href="/brand/logo-mark.png"
        x="0"
        y="0"
        width="100"
        height="114"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}

/**
 * The "Galla by Concilio" wordmark:
 * Bold geometric brand typography in deep merchant navy with "by Concilio" credit.
 */
export function Logo({
  className,
  mark = true,
  subtitle = true,
}: {
  className?: string;
  mark?: boolean;
  subtitle?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-[0.55em] font-bold tracking-tight", className)}>
      {mark && <LogoMark className="size-[1.35em]" />}
      <span className="inline-flex flex-col text-left leading-none">
        <span className="text-[1.15em] font-extrabold tracking-[-0.045em] text-[#032048] dark:text-white">
          Galla
        </span>
        {subtitle && (
          <span className="mt-[0.2em] text-[0.42em] font-semibold tracking-normal text-[#032048]/80 dark:text-slate-300">
            by Concilio
          </span>
        )}
      </span>
    </span>
  );
}

/** Concilio Solutions mark: deep merchant navy tile with white C and emerald check. */
export function ConcilioMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-5", className)}>
      <rect width="32" height="32" rx="8" fill="#032048" />
      <path d="M22 10.5A8 8 0 1 0 22 21.5" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <path d="M12.6 16.2l2.5 2.5 5.2-5.6" fill="none" stroke="#047348" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25.4" cy="16" r="1.4" fill="#ffffff" />
    </svg>
  );
}

/** "Powered by Concilio Solutions" credit used across the product. */
export function PoweredBy({ className }: { className?: string }) {
  return (
    <a
      href="https://concilio.solutions"
      target="_blank"
      rel="noopener noreferrer"
      className={cn("group inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground", className)}
    >
      <span>Powered by</span>
      <span className="inline-flex items-center gap-1.5">
        <ConcilioMark className="size-4 transition-transform group-hover:rotate-[-8deg]" />
        <span className="font-[Georgia,serif] text-[13px] font-semibold normal-case tracking-normal text-[#032048] dark:text-slate-100">
          Concilio <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#047348] dark:text-emerald-400">Solutions</span>
        </span>
      </span>
    </a>
  );
}
