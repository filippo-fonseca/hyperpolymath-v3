"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

// The open full-page view lives in the URL (?view=tasks) so it can be linked,
// survives a reload and works with the browser's back button. It uses the
// native History API, which Next keeps in sync with useSearchParams without a
// server round trip.

const FROM_HOME = "hpFromHome";

function urlWith(key: string | null) {
  const url = new URL(window.location.href);
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
