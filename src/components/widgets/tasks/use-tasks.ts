"use client";

import { useCallback, useMemo, useState } from "react";
import type { Task, TaskStatus } from "@/lib/dashboard-types";
import type { TaskInput } from "@/server/tasks";
import {
  completeTaskAction,
  createTaskAction,
  deleteTaskAction,
  reopenTaskAction,
  rescheduleTasksAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { useDashboard } from "@/components/dashboard/context";
import { useToast } from "@/components/ui/toast";

const key = (t: Task) => `${t.id}:${t.due_date ?? ""}`;

/**
 * Task data plus optimistic operations. Completed rows stay visible (checked)
 * until the server refresh removes them; recurring tasks come back with a new
 * due date and therefore a new key, so they show unchecked again.
 */
export function useTasks() {
  const { data, run } = useDashboard();
  const toast = useToast();
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

  /**
   * Complete with an Undo toast, Todoist style. Undo reopens a plain task; a
   * recurring one has already rolled forward, so undo moves it back.
   */
  const complete = useCallback(
    async (t: Task) => {
      const k = key(t);
      setChecked((s) => new Set(s).add(k));
      setUnchecked((s) => (s.delete(t.id), new Set(s)));
      const undo = async () => {
        setChecked((s) => (s.delete(k), new Set(s)));
        if (t.recurrence) await run(updateTaskAction(t.id, { due_date: t.due_date, status: "todo" }));
        else {
          setUnchecked((s) => new Set(s).add(t.id));
          const ok = await run(reopenTaskAction(t.id));
          if (!ok) setUnchecked((s) => (s.delete(t.id), new Set(s)));
        }
      };
      toast.show(`Completed “${t.title}”`, { action: { label: "Undo", onClick: () => void undo() } });
      const res = await run(completeTaskAction(t.id));
      if (!res) setChecked((s) => (s.delete(k), new Set(s)));
    },
    [run, toast],
  );

  /** Move tasks to a date in one go, with Undo back to where each one was. */
  const reschedule = useCallback(
    async (tasks: Task[], due_date: string | null, label: string) => {
      if (!tasks.length) return;
      const before = new Map(tasks.map((t) => [t.id, t.due_date]));
      setPatches((p) => {
        const n = { ...p };
        for (const t of tasks) n[t.id] = { ...n[t.id], due_date };
        return n;
      });
      const res = await run(rescheduleTasksAction([...before.keys()], due_date));
      const restore = () =>
        setPatches((p) => {
          const n = { ...p };
          for (const t of tasks) n[t.id] = { ...n[t.id], due_date: before.get(t.id) ?? null };
          return n;
        });
      if (res === null) {
        restore();
        return;
      }
      const undo = async () => {
        restore();
        const byDate = new Map<string | null, string[]>();
        for (const [id, d] of before) byDate.set(d, [...(byDate.get(d) ?? []), id]);
        for (const [d, ids] of byDate) await run(rescheduleTasksAction(ids, d));
      };
      const what = tasks.length === 1 ? `“${tasks[0].title}”` : `${tasks.length} tasks`;
      toast.show(due_date ? `Moved ${what} to ${label}` : `Took the date off ${what}`, {
        action: { label: "Undo", onClick: () => void undo() },
      });
    },
    [run, toast],
  );

  const update = useCallback(
    async (t: Task, input: TaskInput) => {
      // `project` is an id in the UI; show it as the row's project_id right away.
      const { project, ...rest } = input;
      const patch: Partial<Task> = { ...(rest as Partial<Task>), ...(project !== undefined ? { project_id: project } : {}) };
      setPatches((p) => ({ ...p, [t.id]: { ...p[t.id], ...patch } }));
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

  return {
    open,
    done,
    isDone,
    toggle,
    complete,
    reschedule,
    update,
    setStatus,
    remove,
    create,
    apply,
    isHidden,
    today: data.today,
  };
}

export function sortToday(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      b.priority - a.priority ||
      (a.due_time ?? "99").localeCompare(b.due_time ?? "99"),
  );
}
