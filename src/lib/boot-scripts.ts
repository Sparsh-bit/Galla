// Inline scripts that run before first paint (via next/script beforeInteractive in the root layout).
// They live here, outside any "use client" module, so the server layout receives their text.

export const THEME_KEY = "theme";

/** Light by default; dark only when the user picks it. Avoids a flash of the wrong theme. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})();`;

/** Low-end PCs (4 cores or fewer, or 4 GB RAM or less) get the lighter look without blur and heavy animation. */
export const LITE_SCRIPT = `(function(){try{var n=navigator;if((n.deviceMemory||8)<=4||(n.hardwareConcurrency||8)<=4)document.documentElement.classList.add("lite")}catch(e){}})();`;

/**
 * Plays the animated welcome once per session when Galla opens as an app (desktop, phone, or an
 * installed web app), or on demand with ?welcome=1. Set before paint so the app never flashes first.
 */
export const SPLASH_SCRIPT = `(function(){try{var w=window,q=location.search.indexOf("welcome=1")>-1,app=/Electron\\//.test(navigator.userAgent)||!!w.Capacitor||(w.matchMedia&&w.matchMedia("(display-mode: standalone)").matches);if(q||(app&&!sessionStorage.getItem("galla.welcomed")))document.documentElement.setAttribute("data-splash","in")}catch(e){}})();`;
