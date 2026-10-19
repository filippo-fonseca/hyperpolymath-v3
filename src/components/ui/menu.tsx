"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { IconCheck } from "./icons";
import { useEscape } from "./primitives";

export type MenuItem =
  | { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; checked?: boolean; hint?: string }
  | { divider: true }
  | { heading: string };

const WIDTH = 220;

/**
 * Small popover menu. The panel is portaled to the body so it never gets
 * clipped by a widget card, and it stops clicks from reaching the card.
 */
export function Menu({
  items,
  label,
  children,
  className = "",
  align = "end",
}: {
  items: MenuItem[];
  /** Accessible name for the trigger button. */
  label: string;
  /** Trigger contents (usually an icon). */
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setAnchor(null), []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setAnchor((a) => (a ? null : e.currentTarget.getBoundingClientRect()));
        }}
        className={className}
      >
        {children}
      </button>
      {anchor && <Panel anchor={anchor} align={align} items={items} onClose={close} returnFocus={trigger} />}
    </>
  );
}

function Panel({
  anchor,
  align,
  items,
  onClose,
  returnFocus,
}: {
  anchor: DOMRect;
  align: "start" | "end";
  items: MenuItem[];
  onClose: () => void;
  returnFocus: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  useEscape(onClose);

  // Place below the trigger, or above it when there isn't room.
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const up = anchor.bottom + 6 + h > vh - 8 && anchor.top - 6 - h > 8;
    const rawLeft = align === "end" ? anchor.right - WIDTH : anchor.left;
    const left = Math.max(8, Math.min(rawLeft, vw - WIDTH - 8));
    setPos({ top: up ? anchor.top - 6 - h : anchor.bottom + 6, left, up });
  }, [anchor, align]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    const back = returnFocus.current;
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [onClose, returnFocus]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? els.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length;
    els[next]?.focus();
  };

  return createPortal(
    <motion.div
      ref={ref}
      role="menu"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.14 }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
      className="fixed z-[70] rounded-[16px] bg-surface p-1.5 shadow-pop"
      style={{
        width: WIDTH,
        top: pos?.top ?? anchor.bottom + 6,
        left: pos?.left ?? anchor.left,
        visibility: pos ? "visible" : "hidden",
        transformOrigin: `${align === "end" ? "right" : "left"} ${pos?.up ? "bottom" : "top"}`,
      }}
    >
      {items.map((it, i) => {
        if ("divider" in it) return <div key={i} className="mx-2 my-1 h-px bg-gray-150" />;
        if ("heading" in it)
          return (
            <div key={i} className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-semibold text-gray-500">
              {it.heading}
            </div>
          );
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              it.onSelect();
            }}
            className={`flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[14px] outline-none transition-colors hover:bg-gray-150 focus-visible:bg-gray-150 ${
              it.danger ? "text-[#d61a2f]" : "text-ink"
            }`}
          >
            {it.icon !== undefined && <span className="flex min-w-4 shrink-0 justify-center text-gray-600">{it.icon}</span>}
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.hint && <span className="shrink-0 text-[12px] text-ink-3">{it.hint}</span>}
            {it.checked && <IconCheck size={15} strokeWidth={2.2} className="shrink-0 text-accent" />}
          </button>
        );
      })}
    </motion.div>,
    document.body,
  );
}
