"use client";

import { useEffect } from "react";
import { animate, stagger } from "animejs";

/** Hero entrance, scroll reveals and count-ups, following the motion of the Galla film. */
export function LandingMotion() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveals = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (reduce) {
      reveals.forEach((el) => el.classList.add("in"));
      return;
    }
    const entrance = animate(".landing-copy > *", {
      opacity: [0, 1],
      translateY: [18, 0],
      filter: ["blur(8px)", "blur(0px)"],
      delay: stagger(110, { start: 80 }),
      duration: 700,
      ease: "out(3)",
    });
    const preview = animate(".landing-preview", { opacity: [0, 1], translateY: [26, 0], scale: [0.98, 1], delay: 260, duration: 950, ease: "out(3)" });

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          el.style.animationDelay = `${Number(el.dataset.delay ?? 0)}ms`;
          el.classList.add("in");
          io.unobserve(el);
        }),
      { threshold: 0.15 },
    );
    reveals.forEach((el) => io.observe(el));

    const counters = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
    const co = new IntersectionObserver((entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        co.unobserve(el);
        const to = Number(el.dataset.count);
        const o = { v: 0 };
        animate(o, { v: to, duration: 1400, ease: "out(4)", onUpdate: () => (el.textContent = `${el.dataset.prefix ?? ""}${Math.round(o.v).toLocaleString("en-IN")}`) });
      }),
    );
    counters.forEach((el) => co.observe(el));

    return () => {
      entrance.pause();
      preview.pause();
      io.disconnect();
      co.disconnect();
    };
  }, []);

  return null;
}
