// Inline scripts that run before first paint (via next/script beforeInteractive in the root layout).
// They live here, outside any "use client" module, so the server layout receives their text.

export const THEME_KEY = "theme";

/** Light by default; dark only when the user picks it. Avoids a flash of the wrong theme. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})();`;

/** Low-end PCs (4 cores or fewer, or 4 GB RAM or less) get the lighter look without blur and heavy animation. */
export const LITE_SCRIPT = `(function(){try{var n=navigator;if((n.deviceMemory||8)<=4||(n.hardwareConcurrency||8)<=4)document.documentElement.classList.add("lite")}catch(e){}})();`;
