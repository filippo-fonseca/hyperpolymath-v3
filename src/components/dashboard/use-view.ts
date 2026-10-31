"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

// The open full-page view lives in the URL (?view=tasks) so it can be linked,
// survives a reload and works with the browser's back button. It uses the
// native History API, which Next keeps in sync with useSearchParams without a
// server round trip.

const FROM_HOME = "hpFromHome";
// A view can keep one sub-mode in the URL too (?view=projects&mode=tree).
// It belongs to the open view, so switching or closing views drops it.
const MODE = "mode";

function urlWith(key: string | null) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("view") !== key) url.searchParams.delete(MODE);
  if (key) url.searchParams.set("view", key);
  else url.searchParams.delete("view");
  return url.pathname + url.search + url.hash;
}

export function useView() {
  const view = useSearchParams().get("view");

  /**
   * Open a view. From the dashboard this adds a history entry; switching
   * between views replaces it, so Back always lands on the dashboard.
   */
  const openView = useCallback((key: string) => {
    const current = new URL(window.location.href).searchParams.get("view");
    if (current === key) return;
    if (current) {
      const fromHome = !!(window.history.state as Record<string, unknown> | null)?.[FROM_HOME];
      window.history.replaceState({ [FROM_HOME]: fromHome }, "", urlWith(key));
    } else {
      window.history.pushState({ [FROM_HOME]: true }, "", urlWith(key));
    }
  }, []);

  /** Back to the dashboard: pops our own entry, or rewrites a deep link in place. */
  const closeView = useCallback(() => {
    if (!new URL(window.location.href).searchParams.get("view")) return;
    if ((window.history.state as Record<string, unknown> | null)?.[FROM_HOME]) window.history.back();
    else window.history.replaceState({}, "", urlWith(null));
  }, []);

  return { view, openView, closeView };
}

/**
 * The open view's sub-mode from ?mode=, or the fallback. Changing it replaces
 * the history entry (keeping our own state), so Back still lands on the
 * dashboard and a reload reopens the same mode.
 */
export function useViewMode<T extends string>(modes: readonly T[], fallback: T) {
  const raw = useSearchParams().get(MODE);
  const mode = modes.includes(raw as T) ? (raw as T) : fallback;
  const setMode = useCallback(
    (next: T) => {
      const url = new URL(window.location.href);
      if (next === fallback) url.searchParams.delete(MODE);
      else url.searchParams.set(MODE, next);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    },
    [fallback],
  );
  return [mode, setMode] as const;
}
