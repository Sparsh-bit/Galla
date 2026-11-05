import { cn } from "@/lib/utils";

/** Galla app icon: an amber tile holding a cash box with a rupee coin dropping in. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <defs>
        <linearGradient id="galla-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbf4a" />
          <stop offset="1" stopColor="#e07b12" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#galla-tile)" />
      <circle cx="16" cy="8.6" r="3.9" fill="#14161f" />
      <path d="M14 7.2h4M14 8.9h4M14.2 7.2c2.7 0 2.7 3 0 3H14l3.1 2.6" fill="none" stroke="#fbbf4a" strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 16.5c0-.8.7-1.5 1.5-1.5h16c.8 0 1.5.7 1.5 1.5V17H6.5z" fill="#14161f" />
      <rect x="5.5" y="16.6" width="21" height="9.6" rx="2.6" fill="#14161f" />
      <rect x="12.5" y="20.4" width="7" height="1.8" rx="0.9" fill="#fbbf4a" />
    </svg>
  );
}

/** The "galla." wordmark: heavy lowercase with an amber full stop. */
export function Logo({ className, mark = true }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-[-0.05em]", className)}>
      {mark && <LogoMark className="size-7" />}
      <span className="leading-none">
        galla<span className="text-[#f5a524]">.</span>
      </span>
    </span>
  );
}

/** Concilio Solutions mark: a "C" ring with a check. */
export function ConcilioMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-5", className)}>
      <rect width="32" height="32" rx="8" fill="#14161f" />
      <path d="M22 10.5A8 8 0 1 0 22 21.5" fill="none" stroke="#f2f2f5" strokeWidth="3" strokeLinecap="round" />
      <path d="M12.6 16.2l2.5 2.5 5.2-5.6" fill="none" stroke="#4fd1b5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25.4" cy="16" r="1.4" fill="#f2f2f5" />
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
        <span className="font-[Georgia,serif] text-[13px] font-semibold normal-case tracking-normal text-foreground">Concilio <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#2fa58d]">Solutions</span></span>
      </span>
    </a>
  );
}
