"use client";

import { useCallback, useMemo, useState } from "react";
import type { Task, TaskStatus } from "@/lib/dashboard-types";
import type { TaskInput } from "@/server/tasks";
import {
  completeTaskAction,
  createTaskAction,
  deleteTaskAction,
  reopenTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { useDashboard } from "@/components/dashboard/context";

const key = (t: Task) => `${t.id}:${t.due_date ?? ""}`;

/**
 * Task data plus optimistic operations. Completed rows stay visible (checked)
 * until the server refresh removes them; recurring tasks come back with a new
 * due date and therefore a new key, so they show unchecked again.
 */
export function useTasks() {
  const { data, run } = useDashboard();
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set());
  const [patches, setPatches] = useState<Record<string, Partial<Task>>>({});
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const apply = useCallback((t: Task): Task => (patches[t.id] ? { ...t, ...patches[t.id] } : t), [patches]);

  const open = useMemo(() => data.openTasks.filter((t) => !hidden.has(t.id)).map(apply), [data.openTasks, hidden, apply]);
  const done = useMemo(() => data.doneTasks.filter((t) => !hidden.has(t.id)).map(apply), [data.doneTasks, hidden, apply]);

  const isDone = useCallback(
    (t: Task) => (t.status === "done" ? !unchecked.has(t.id) : checked.has(key(t))),
    [checked, unchecked],
  );

  const toggle = useCallback(
    async (t: Task) => {
      if (isDone(t)) {
        setChecked((s) => {
          const n = new Set(s);
          n.delete(key(t));
          return n;
        });
        if (t.status === "done") setUnchecked((s) => new Set(s).add(t.id));
        const res = await run(reopenTaskAction(t.id));
        if (!res) setUnchecked((s) => (s.delete(t.id), new Set(s)));
      } else {
        setChecked((s) => new Set(s).add(key(t)));
        setUnchecked((s) => (s.delete(t.id), new Set(s)));
        const res = await run(completeTaskAction(t.id));
        if (!res) setChecked((s) => (s.delete(key(t)), new Set(s)));
      }
    },
    [isDone, run],
  );

  const update = useCallback(
    async (t: Task, input: TaskInput) => {
      setPatches((p) => ({ ...p, [t.id]: { ...p[t.id], ...(input as Partial<Task>) } }));
      const res = await run(updateTaskAction(t.id, input));
      if (!res) {
        setPatches((p) => {
          const n = { ...p };
          delete n[t.id];
          return n;
        });
      }
      return res;
    },
    [run],
  );

  const setStatus = useCallback(
    (t: Task, status: TaskStatus) => {
      if (status === t.status) return;
      return update(t, { status });
    },
    [update],
  );

  const remove = useCallback(
    async (t: Task) => {
      setHidden((s) => new Set(s).add(t.id));
      const res = await run(deleteTaskAction(t.id), { success: `Deleted “${t.title}”` });
      if (!res) setHidden((s) => (s.delete(t.id), new Set(s)));
    },
    [run],
  );

  const create = useCallback(
    (input: TaskInput & { title: string }) => run(createTaskAction(input)),
    [run],
  );

  const isHidden = useCallback((t: Task) => hidden.has(t.id), [hidden]);

  return { open, done, isDone, toggle, update, setStatus, remove, create, apply, isHidden, today: data.today };
}

export function sortToday(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      b.priority - a.priority ||
      (a.due_time ?? "99").localeCompare(b.due_time ?? "99"),
  );
}
