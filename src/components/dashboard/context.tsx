"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CalendarData, DashboardData } from "@/lib/dashboard-types";
import type { Result } from "@/app/actions/run";
import { useToast } from "@/components/ui/toast";

type RunOpts = { success?: string; quiet?: boolean };

type DashboardApi = {
  data: DashboardData;
  calendar: Promise<CalendarData>;
  nowMs: number;
  /** Await a server action; toasts its error and returns null on failure. */
  run: <T>(p: Promise<Result<T>>, opts?: RunOpts) => Promise<T | null>;
  open: (widgetId: string) => void;
  openSettings: () => void;
};

const Ctx = createContext<DashboardApi | null>(null);

export function useDashboard(): DashboardApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard outside DashboardProvider");
  return v;
}

/** Ticking clock that starts at the server's time so the first render matches. */
function useNow(initialIso: string) {
  const [now, setNow] = useState(() => Date.parse(initialIso));
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = window.setTimeout(tick, 0);
    const i = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(i);
    };
  }, []);
  return now;
}

export function DashboardProvider({
  data,
  calendar,
  open,
  openSettings,
  children,
}: {
  data: DashboardData;
  calendar: Promise<CalendarData>;
  open: (id: string) => void;
  openSettings: () => void;
  children: ReactNode;
}) {
  const toast = useToast();
  const nowMs = useNow(data.nowIso);

  const run = useCallback(
    async <T,>(p: Promise<Result<T>>, opts: RunOpts = {}): Promise<T | null> => {
      try {
        const res = await p;
        if (!res.ok) {
          if (!opts.quiet) toast.error(res.error);
          return null;
        }
        if (opts.success) toast.show(opts.success);
        return res.data;
      } catch {
        if (!opts.quiet) toast.error("Couldn't reach the server. Check your connection.");
        return null;
      }
    },
    [toast],
  );

  const value = useMemo(
    () => ({ data, calendar, nowMs, run, open, openSettings }),
    [data, calendar, nowMs, run, open, openSettings],
  );
  return <Ctx value={value}>{children}</Ctx>;
}
