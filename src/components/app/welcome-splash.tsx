"use client";
import { useEffect } from "react";

const DONE_KEY = "galla.welcomed";

/**
 * The opening of the Galla film, as the app's welcome: the cash-box tile tumbles in, a rupee coin
 * drops into it, "galla." rises letter by letter and the tagline blurs into focus. Shown only while
 * <html data-splash> is set (see SPLASH_SCRIPT); a click or key skips it.
 */
export function WelcomeSplash() {
  useEffect(() => {
    const el = document.documentElement;
    if (!el.hasAttribute("data-splash")) return;
    try {
      sessionStorage.setItem(DONE_KEY, "1");
    } catch {}
    const quick = matchMedia("(prefers-reduced-motion: reduce)").matches || el.classList.contains("lite");
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = () => {
      if (el.getAttribute("data-splash") !== "in") return;
      el.setAttribute("data-splash", "out");
      timers.push(setTimeout(() => el.removeAttribute("data-splash"), 450));
    };
    timers.push(setTimeout(finish, quick ? 900 : 3000));
    const skip = () => finish();
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  return (
    <div className="welcome-splash" aria-hidden="true">
      <div className="ws-glow" />
      <div className="ws-stage">
        <svg viewBox="0 0 32 32" className="ws-tile">
          <defs>
            <linearGradient id="ws-tile-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fbbf4a" />
              <stop offset="1" stopColor="#e07b12" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="8" fill="url(#ws-tile-g)" />
          <g className="ws-coin">
            <circle cx="16" cy="8.6" r="3.9" fill="#14161f" />
            <path d="M14 7.2h4M14 8.9h4M14.2 7.2c2.7 0 2.7 3 0 3H14l3.1 2.6" fill="none" stroke="#fbbf4a" strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g className="ws-drawer">
            <path d="M6.5 16.5c0-.8.7-1.5 1.5-1.5h16c.8 0 1.5.7 1.5 1.5V17H6.5z" fill="#14161f" />
            <rect x="5.5" y="16.6" width="21" height="9.6" rx="2.6" fill="#14161f" />
            <rect x="12.5" y="20.4" width="7" height="1.8" rx="0.9" fill="#fbbf4a" />
          </g>
          <rect className="ws-shine" x="-12" y="0" width="8" height="32" fill="#fff" opacity="0.35" transform="skewX(-18)" />
        </svg>
        <p className="ws-word">
          {"galla".split("").map((c, i) => <span key={i} style={{ animationDelay: `${700 + i * 70}ms` }}>{c}</span>)}
          <span className="ws-dot" />
        </p>
      </div>
      <p className="ws-tag">Your shop&rsquo;s <em>digital cash box.</em></p>
      <p className="ws-power">Powered by Concilio Solutions</p>
    </div>
  );
}
