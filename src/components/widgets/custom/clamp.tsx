"use client";

import { useLayoutEffect, useState } from "react";

// Compact custom widgets render their whole payload and then hide whatever
// doesn't fit. Items marked `data-clamp` (and section headings marked
// `data-clamp="heading"`) that would cross the bottom edge are made
// invisible but keep their space, so the content's natural height stays
// measurable for fitting the card to it.

const MORE_H = 26;

export type ClampState = { more: number; top: number };

export function useClamp(body: HTMLElement | null, inner: HTMLElement | null, key: unknown): ClampState {
  const [state, setState] = useState<ClampState>({ more: 0, top: 0 });

  useLayoutEffect(() => {
    if (!body || !inner) return;
    const measure = () => {
      const items = Array.from(inner.querySelectorAll<HTMLElement>("[data-clamp]"));
      const hide = (el: HTMLElement) => (el.style.visibility = "hidden");
      for (const el of items) el.style.removeProperty("visibility");
      const room = body.clientHeight;
      if (inner.offsetHeight <= room + 1) {
        setState((s) => (s.more === 0 && s.top === 0 ? s : { more: 0, top: 0 }));
        return;
      }
      // Offsets relative to the body (it's the positioned ancestor), so the
      // card's morph and wiggle transforms don't skew the measurement.
      const bottomOf = (el: HTMLElement) => {
        let top = 0;
        let node: HTMLElement | null = el;
        while (node && node !== body) {
          top += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }
        return top + el.offsetHeight;
      };
      const limit = room - MORE_H;
      const visible: HTMLElement[] = [];
      let hidden = 0;
      for (const el of items) {
        if (bottomOf(el) <= limit) {
          visible.push(el);
        } else {
          hide(el);
          if (el.dataset.clamp !== "heading") hidden++;
        }
      }
      // Never end on a section heading with nothing under it.
      while (visible.length && visible[visible.length - 1].dataset.clamp === "heading") {
        hide(visible.pop()!);
      }
      const top = visible.length ? Math.max(...visible.map(bottomOf)) : 0;
      setState((s) => (s.more === hidden && s.top === top ? s : { more: hidden, top }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [body, inner, key]);

  return state;
}
