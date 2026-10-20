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
      const place = (limit: number) => {
        const visible: HTMLElement[] = [];
        const hidden: HTMLElement[] = [];
        for (const el of items) (bottomOf(el) <= limit ? visible : hidden).push(el);
        // Never end on a section heading with nothing under it.
        while (visible.length && visible[visible.length - 1].dataset.clamp === "heading") hidden.unshift(visible.pop()!);
        return { visible, hidden };
      };
      const isItem = (el: HTMLElement) => el.dataset.clamp !== "heading";
      // Leave a line for "N more"; on a tiny card, give that line to the first
      // item instead, and keep at least one item even if it has to be cut.
      let { visible, hidden } = place(room - MORE_H);
      if (!visible.some(isItem)) ({ visible, hidden } = place(room));
      if (!visible.some(isItem)) {
        const first = hidden.findIndex(isItem);
        if (first >= 0) {
          visible = [...visible, ...hidden.slice(0, first + 1)];
          hidden = hidden.slice(first + 1);
        }
      }
      for (const el of hidden) hide(el);
      const top = visible.length ? Math.max(...visible.map(bottomOf)) : 0;
      // Only offer "N more" where it has room to sit; the card opens in full either way.
      const more = top + MORE_H <= room ? hidden.filter(isItem).length : 0;
      setState((s) => (s.more === more && s.top === top ? s : { more, top }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [body, inner, key]);

  return state;
}
