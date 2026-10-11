"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

type Toast = {
  id: number;
  text: string;
  tone: "neutral" | "error";
  action?: { label: string; onClick: () => void };
};

type ToastApi = {
  show: (text: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"]; duration?: number }) => void;
  error: (text: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast outside ToastProvider");
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastApi["show"]>(
    (text, opts = {}) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-2), { id, text, tone: opts.tone ?? "neutral", action: opts.action }]);
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 6000 : 3600));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ show, error: (text) => show(text, { tone: "error" }) }), [show]);

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(20px,env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18 } }}
              transition={{ type: "spring", duration: 0.32, bounce: 0 }}
              className="pointer-events-auto flex max-w-[420px] items-center gap-3 rounded-full bg-ink py-2.5 pl-4 pr-2.5 text-[14px] text-white shadow-lift"
            >
              {t.tone === "error" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />}
              <span className="min-w-0 flex-1 leading-snug">{t.text}</span>
              {t.action ? (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="rounded-full bg-white/12 px-3 py-1 text-[13px] font-medium text-white transition hover:bg-white/20"
                >
                  {t.action.label}
                </button>
              ) : (
                <span className="w-1.5" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext>
  );
}
