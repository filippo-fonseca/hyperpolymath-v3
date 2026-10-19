"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useEscape, useScrollLock } from "@/components/ui/primitives";

/**
 * Full-page view a widget morphs into (shared layoutId with its card). It
 * covers the dashboard, carries the app bar, and scrolls on its own.
 * Rendered inside AnimatePresence by the dashboard.
 */
export function ExpandedView({
  id,
  onClose,
  escapeActive = true,
  wide = false,
  bar,
  children,
}: {
  id: string;
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
  useEscape(onClose, escapeActive);
  useScrollLock(true);

  return (
    <div className="fixed inset-0 z-50" role="region" aria-label="Full view">
      <motion.div
        layoutId={`widget-${id}`}
        transition={{ type: "spring", duration: 0.38, bounce: 0 }}
        className="absolute inset-0 overflow-hidden bg-bg"
        style={{ borderRadius: 0 }}
      >
        <motion.div
          className="h-full overflow-y-auto overscroll-contain"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.22 } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          onScroll={(e) => {
            const s = e.currentTarget.scrollTop > 4;
            if (s !== scrolled) setScrolled(s);
          }}
        >
          {bar(scrolled)}
          <div
            className={`mx-auto w-full px-4 pb-[max(64px,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-8 ${
              wide ? "max-w-[1168px]" : "max-w-[960px]"
            }`}
          >
            {children}
          </div>
        </motion.div>
      </motion.div>
    </div>
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
