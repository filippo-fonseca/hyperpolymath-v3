"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { KiwiOffline } from "@/components/illustrations";

// A small banner while the browser is offline, and a brief "back online"
// note (with a fresh server render) when it reconnects.

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const router = useRouter();
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    let t: number | undefined;
    const onOnline = () => {
      setBackOnline(true);
      // Pick up whatever changed while we were away.
      router.refresh();
      window.clearTimeout(t);
      t = window.setTimeout(() => setBackOnline(false), 2600);
    };
    const onOffline = () => {
      window.clearTimeout(t);
      setBackOnline(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [router]);

  const show = !online || backOnline;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[90] flex justify-center px-4"
    >
      <AnimatePresence>
        {show && (
          <motion.div
            key={online ? "on" : "off"}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18 } }}
            transition={{ type: "spring", duration: 0.34, bounce: 0 }}
            className="pointer-events-auto flex max-w-[420px] items-center gap-2.5 rounded-full bg-surface py-1.5 pl-1.5 pr-4 shadow-pop"
          >
            {online ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
                <span className="h-2 w-2 rounded-full bg-success" />
              </span>
            ) : (
              <span aria-hidden className="shrink-0">
                <KiwiOffline size={36} />
              </span>
            )}
            <span className="min-w-0 text-[13.5px] leading-snug">
              {online ? (
                <span className="font-medium">Back online</span>
              ) : (
                <>
                  <span className="font-medium">You&apos;re offline.</span>{" "}
                  <span className="text-ink-2">Changes won&apos;t save until the connection returns.</span>
                </>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
