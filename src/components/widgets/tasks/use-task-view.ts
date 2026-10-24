"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_VIEWS, type TaskViewKey, type TaskViewPrefs } from "@/lib/task-view";
import { setTaskViewAction } from "@/app/actions/settings";
import { useDashboard } from "@/components/dashboard/context";

// Changes show at once in every list using that tab (the full view and the
// dashboard card share Today), and save to settings a moment later so a few
// quick clicks make one write.

const local = new Map<string, TaskViewPrefs>();
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const SAVE_DELAY = 400;

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useTaskView(view: TaskViewKey) {
  const { data, run } = useDashboard();
  const id = `${data.userId}:${view}`;
  const saved = data.taskViews[view];
  const prefs = useSyncExternalStore(
    subscribe,
    () => local.get(id) ?? saved,
    () => saved,
  );

  const set = useCallback(
    (patch: Partial<TaskViewPrefs>) => {
      const next = { ...(local.get(id) ?? saved), ...patch };
      local.set(id, next);
      listeners.forEach((fn) => fn());
      clearTimeout(timers.get(id));
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          void run(setTaskViewAction({ view, prefs: next }));
        }, SAVE_DELAY),
      );
    },
    [id, saved, view, run],
  );

  const reset = useCallback(() => set(DEFAULT_VIEWS[view]), [set, view]);

  return { prefs, set, reset };
}
