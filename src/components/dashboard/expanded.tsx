"use client";

import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useEscape, useScrollLock } from "@/components/ui/primitives";
import type { CardRect } from "./widget-card";

// The full-page view. One shell stays mounted while any view is open, so
// moving between Tasks, Calendar and the rest only crossfades the page inside
// it. The shell grows out of a card only when you opened it from that card,
// and on close it folds back into the card of whatever view is showing (when
// that card is on screen), otherwise it fades.

const MORPH = { type: "spring", duration: 0.5, bounce: 0.08 } as const;
const RADIUS = 22;

function inset(r: CardRect | null) {
  if (!r || typeof window === "undefined") return null;
  const right = Math.max(0, window.innerWidth - r.left - r.width);
  const bottom = Math.max(0, window.innerHeight - r.top - r.height);
  return `inset(${r.top}px ${right}px ${bottom}px ${r.left}px round ${RADIUS}px)`;
}
const FULL = "inset(0px 0px 0px 0px round 0px)";

/** Where the open view would fold back to, measured as the close starts. */
export type CloseTarget = () => CardRect | null;

const shell: Variants = {
  from: (from: CardRect | null) => {
    const clip = inset(from);
    return clip ? { clipPath: clip, opacity: 1, y: 0, scale: 1 } : { clipPath: FULL, opacity: 0, y: 18, scale: 0.99 };
  },
  open: { clipPath: FULL, opacity: 1, y: 0, scale: 1, transition: { ...MORPH, opacity: { duration: 0.22 } } },
  // `custom` on exit comes from AnimatePresence: a function that finds the card now.
  to: (target?: CloseTarget) => {
    const clip = inset(typeof target === "function" ? target() : null);
    return clip
      ? { clipPath: clip, transition: MORPH }
      : { opacity: 0, y: 14, scale: 0.99, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } };
  },
};

// The bar and page inherit the shell's state: hidden while a card grows, in
// once it has room, and out quickly as it folds back so the card takes over.
const inside: Variants = {
  from: (from: CardRect | null) => ({ opacity: from ? 0 : 1 }),
  open: { opacity: 1, transition: { delay: 0.12, duration: 0.26 } },
  to: { opacity: 0, transition: { duration: 0.12 } },
};

export function ExpandedView({
  viewKey,
  from,
  onClose,
  escapeActive = true,
  wide = false,
  bar,
  children,
}: {
  /** Which view is showing; changing it crossfades the page, the shell stays. */
  viewKey: string;
  /** The card it was opened from, to grow out of (null: it fades in). */
  from: CardRect | null;
  onClose: () => void;
  /** False while something is layered on top (a sheet, Teammates), so Esc closes only that. */
  escapeActive?: boolean;
  /** Calendar-style views that want the full container width. */
  wide?: boolean;
  /** The app bar, given whether the page has scrolled. */
  bar: (scrolled: boolean) => ReactNode;
  children: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [origin] = useState(from);
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  useEscape(onClose, escapeActive);
  useScrollLock(true);

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-hidden bg-bg will-change-[clip-path]"
      role="region"
      aria-label="Full view"
      custom={origin}
      variants={shell}
      initial={reduce ? false : "from"}
      animate="open"
      exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : "to"}
    >
      <div
        ref={scroller}
        className="h-full overflow-y-auto overscroll-contain"
        onScroll={(e) => {
          const s = e.currentTarget.scrollTop > 4;
          if (s !== scrolled) setScrolled(s);
        }}
      >
        {/* The bar is part of the shell: it stays put while pages change under it. */}
        <motion.div custom={origin} variants={inside}>
          {bar(scrolled)}
        </motion.div>
        <motion.div
          custom={origin}
          variants={inside}
          className={`mx-auto w-full px-4 pb-[max(64px,env(safe-area-inset-bottom))] pt-4 transition-[max-width] duration-300 sm:px-6 sm:pt-8 ${
            wide ? "max-w-[1168px]" : "max-w-[960px]"
          }`}
        >
          <AnimatePresence
            mode="wait"
            initial={false}
            onExitComplete={() => {
              scroller.current?.scrollTo({ top: 0 });
              setScrolled(false);
            }}
          >
            <motion.div
              key={viewKey}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { type: "spring", duration: 0.42, bounce: 0 } }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, transition: { duration: 0.12, ease: "easeIn" } }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

/** Title block used at the top of every expanded view. */
export function ExpandedHeader({
  eyebrow,
  title,
  aside,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-6 flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] font-semibold text-gray-500">{eyebrow}</div>}
        <h1 className="truncate text-[30px] font-bold leading-tight tracking-[-0.025em]">{title}</h1>
      </div>
      {aside}
    </div>
  );
}
