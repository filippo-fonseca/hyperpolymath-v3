"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconCheck, IconClose } from "./icons";
import { WEEKDAY_LETTERS } from "@/lib/format";

/* ---------- hooks ---------- */

export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

// Escape closes only the topmost layer (a sheet over an expanded view, a
// picker over a sheet). Layers stack in the order they became active.
const escapeLayers: { fire: () => void }[] = [];
let escapeListening = false;

function onEscapeKey(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  escapeLayers[escapeLayers.length - 1]?.fire();
}

export function useEscape(onEscape: () => void, active = true) {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    const layer = { fire: () => handler.current() };
    escapeLayers.push(layer);
    if (!escapeListening) {
      window.addEventListener("keydown", onEscapeKey);
      escapeListening = true;
    }
    return () => {
      const i = escapeLayers.indexOf(layer);
      if (i >= 0) escapeLayers.splice(i, 1);
    };
  }, [active]);
}

// Focus trapping for modal layers. Only the topmost trap handles Tab, so a
// picker over a sheet keeps focus in the picker.
const focusTraps: HTMLElement[] = [];
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function onTrapKey(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const root = focusTraps[focusTraps.length - 1];
  if (!root) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (!items.length) {
    e.preventDefault();
    root.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const current = document.activeElement as HTMLElement | null;
  if (!current || !root.contains(current)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && (current === first || current === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && current === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * Keep Tab inside `el` while active, move focus into it on open, and give
 * focus back to whatever had it before when it closes.
 */
export function useFocusTrap(el: HTMLElement | null, active: boolean) {
  useEffect(() => {
    if (!active || !el) return;
    const previous = document.activeElement as HTMLElement | null;
    focusTraps.push(el);
    if (focusTraps.length === 1) document.addEventListener("keydown", onTrapKey);
    // Let an autoFocus child win; otherwise focus the dialog itself so screen
    // readers announce its title.
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
    return () => {
      const i = focusTraps.indexOf(el);
      if (i >= 0) focusTraps.splice(i, 1);
      if (!focusTraps.length) document.removeEventListener("keydown", onTrapKey);
      if (previous && previous.isConnected && previous !== document.body) {
        window.setTimeout(() => previous.focus({ preventScroll: true }), 0);
      }
    };
  }, [el, active]);
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

/** Stop a click inside an interactive control from opening the widget. */
export const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/* ---------- buttons ---------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "dark" | "ghost" | "soft" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "soft", size = "md", className = "", ...rest }: BtnProps) {
  const v = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    dark: "bg-ink text-white hover:bg-gray-900",
    ghost: "text-gray-700 hover:bg-gray-150",
    soft: "bg-gray-150 text-ink hover:bg-gray-200",
    danger: "bg-danger-soft text-[#d61a2f] hover:bg-[rgb(255_38_60/0.14)]",
  }[variant];
  const s = size === "sm" ? "h-8 px-3 text-[13px] gap-1.5" : "h-10 px-4 text-[14px] gap-2";
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium transition-[background,transform,opacity] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${s} ${v} ${className}`}
      {...rest}
    />
  );
}

export function IconButton({
  label,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-150 active:scale-95 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function CloseButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-150 text-gray-800 transition hover:bg-gray-200 active:scale-95 ${className}`}
    >
      <IconClose size={17} strokeWidth={2} />
    </button>
  );
}

/* ---------- inputs ---------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = "",
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const uid = useId();
  return (
    <div className={`inline-flex rounded-full bg-gray-150 p-[3px] ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-200 ${
              size === "sm" ? "h-7 px-3 text-[12.5px]" : "h-8 px-3.5 text-[13.5px]"
            } ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${uid}`}
                className="absolute inset-0 rounded-full bg-white shadow-ring"
                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex gap-1.5">
      {WEEKDAY_LETTERS.map((l, i) => {
        const on = value.includes(i);
        return (
          <button
            key={i}
            type="button"
            aria-pressed={on}
            aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i]}
            onClick={() => {
              const next = on ? value.filter((d) => d !== i) : [...value, i].sort();
              if (next.length) onChange(next);
            }}
            className={`h-8 w-8 rounded-full text-[12.5px] font-semibold transition-colors duration-200 ${
              on ? "bg-ink text-white" : "bg-gray-150 text-ink-2 hover:bg-gray-200"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({
  checked,
  onToggle,
  label,
  size = 20,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={stop}
      className={`group/cb relative inline-flex shrink-0 items-center justify-center rounded-[6px] transition-all duration-200 ${
        checked ? "bg-accent text-white" : "text-transparent shadow-[inset_0_0_0_1.5px_var(--gray-400)] hover:shadow-[inset_0_0_0_1.5px_var(--gray-600)]"
      }`}
      style={{ width: size, height: size }}
    >
      <IconCheck size={size - 6} strokeWidth={2.6} />
    </button>
  );
}

export const fieldClass =
  "h-10 min-w-0 rounded-[12px] bg-gray-100 px-3 text-[14px] outline-none ring-1 ring-transparent transition placeholder:text-ink-3 focus:bg-white focus:ring-accent/35";

/* ---------- sheet ---------- */

/** Bottom sheet on phones, centered panel on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const desktop = useMediaQuery("(min-width: 640px)");
  const titleId = useId();
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  useEscape(onClose, open);
  useScrollLock(open);
  useFocusTrap(panel, open);
  return (
    <AnimatePresence>
      {open && (
        <div key="sheet" className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-[rgb(20_20_20/0.18)] backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            ref={setPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={desktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.98, y: 4 } : { y: "100%" }}
            transition={{ type: "spring", duration: 0.36, bounce: 0 }}
            className="relative max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-[26px] bg-surface pb-[max(20px,env(safe-area-inset-bottom))] shadow-lift outline-none sm:rounded-[26px] sm:pb-5"
            style={{ maxWidth: desktop ? width : undefined }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between bg-surface/90 px-5 pb-3 pt-4 backdrop-blur">
              <div id={titleId} role="heading" aria-level={2} className="min-w-0 text-[17px] font-semibold tracking-[-0.01em]">
                {title}
              </div>
              <CloseButton onClick={onClose} />
            </div>
            <div className="px-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[12px] font-semibold text-gray-500 ${className}`}>{children}</div>;
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="py-6 text-center text-[13.5px] text-ink-3">{children}</div>;
}

/** How many rows of `rowHeight` fit in the element (for widgets that grow with the grid). */
export function useFitCount<T extends HTMLElement>(rowHeight: number, fallback: number) {
  const [count, setCount] = useState(fallback);
  const [el, setEl] = useState<T | null>(null);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setCount(Math.max(1, Math.floor((entry.contentRect.height + 0.5) / rowHeight)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, rowHeight]);
  return [setEl, count] as const;
}

/** iOS-style on/off switch. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200"
      style={{ background: checked ? "var(--accent)" : "var(--gray-300)" }}
    >
      <span
        className="absolute left-0 top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200"
        style={{ transform: `translateX(${checked ? 21 : 3}px)` }}
      />
    </button>
  );
}
