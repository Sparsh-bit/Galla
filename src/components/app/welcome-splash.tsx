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
        <svg viewBox="0 0 100 114" className="ws-tile">
          <defs>
            <linearGradient id="ws-green" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#058252" />
              <stop offset="100%" stopColor="#047348" />
            </linearGradient>
            <linearGradient id="ws-navy" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#062b5d" />
              <stop offset="100%" stopColor="#032048" />
            </linearGradient>
          </defs>
          {/* Canopy awning */}
          <g className="ws-coin">
            <path
              d="M 23 2 L 77 2 L 95 27 C 94 32 85 33 82 29 C 78 33 69 33 66 29 C 62 33 53 33 50 29 C 46 33 37 33 34 29 C 31 33 22 33 19 29 C 16 33 7 32 5 27 Z"
              fill="url(#ws-green)"
            />
          </g>
          {/* Navy G body */}
          <g className="ws-drawer">
            <path
              d="M 44 28 C 22 28 8 44 8 68 C 8 93 24 112 50 112 C 72 112 88 98 92 78 L 92 48 L 52 48 L 52 64 L 75 64 C 74 74 65 82 51 82 C 34 82 25 72 25 58 C 25 43 35 34 49 34 L 54 34 Z"
              fill="url(#ws-navy)"
            />
            {/* Emerald billing document inside G */}
            <rect x="52" y="52" width="28" height="34" rx="4" fill="url(#ws-green)" />
            <rect x="57" y="59" width="18" height="2.8" rx="1.4" fill="#ffffff" />
            <rect x="57" y="66" width="18" height="2.8" rx="1.4" fill="#ffffff" />
            <rect x="57" y="73" width="13" height="2.8" rx="1.4" fill="#ffffff" />
          </g>
          <image
            href="/brand/logo-mark.png"
            x="0"
            y="0"
            width="100"
            height="114"
            preserveAspectRatio="xMidYMid meet"
          />
          <rect className="ws-shine" x="-30" y="0" width="20" height="114" fill="#ffffff" opacity="0.3" transform="skewX(-18)" />
        </svg>
        <div className="flex flex-col text-left">
          <p className="ws-word">
            {"Galla".split("").map((c, i) => (
              <span key={i} style={{ animationDelay: `${700 + i * 70}ms` }}>
                {c}
              </span>
            ))}
            <span className="ws-dot" />
          </p>
          <p
            className="text-[1.2rem] font-semibold text-[#032048]/80 dark:text-slate-300"
            style={{ animation: "ws-fade 600ms ease 1200ms both" }}
          >
            by Concilio
          </p>
        </div>
      </div>
      <p className="ws-tag">Your shop&rsquo;s <em>digital cash box.</em></p>
      <p className="ws-power">Powered by Concilio Solutions</p>
    </div>
  );
}
