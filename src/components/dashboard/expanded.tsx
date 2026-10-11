"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { CloseButton, useEscape, useMediaQuery, useScrollLock } from "@/components/ui/primitives";

/**
 * Full-screen view a widget morphs into (shared layoutId with its card).
 * Rendered inside AnimatePresence by the dashboard.
 */
export function ExpandedView({ id, onClose, children }: { id: string; onClose: () => void; children: ReactNode }) {
  const desktop = useMediaQuery("(min-width: 640px)");
  useEscape(onClose);
  useScrollLock(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
      <motion.div
        className="absolute inset-0 bg-[rgb(252_252_252/0.8)] backdrop-blur-[12px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.24 } }}
        transition={{ duration: 0.28 }}
        onClick={onClose}
      />
      <motion.div
        layoutId={`widget-${id}`}
        transition={{ type: "spring", duration: 0.38, bounce: 0 }}
        role="dialog"
        aria-modal="true"
        className="relative flex h-full w-full flex-col overflow-hidden bg-surface shadow-lift sm:h-[min(880px,calc(100dvh-48px))] sm:max-w-[980px]"
        style={{ borderRadius: desktop ? 28 : 0 }}
      >
        <CloseButton onClick={onClose} className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] z-20 sm:right-5 sm:top-5" />
        <motion.div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.24 } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          <div className="mx-auto w-full max-w-[860px] px-5 pb-16 pt-[max(20px,env(safe-area-inset-top))] sm:px-10 sm:pt-9">
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
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 pr-12">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] font-semibold text-gray-500">{eyebrow}</div>}
        <h2 className="truncate text-[28px] font-bold leading-tight tracking-[-0.02em]">{title}</h2>
      </div>
      {aside}
    </div>
  );
}
