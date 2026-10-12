"use client";

import { useEffect } from "react";

/**
 * Arms the landing page's scroll reveals. Until this runs (or if it never
 * does) every `[data-reveal]` element is simply visible. Anything already on
 * or above the screen is marked shown before arming, so nothing flashes.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".landing-page");
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-shown", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of items) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.setAttribute("data-shown", "");
      else io.observe(el);
    }
    root.classList.add("reveal-armed");
    return () => io.disconnect();
  }, []);
  return null;
}
