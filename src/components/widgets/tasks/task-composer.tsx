"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { parseQuickAdd } from "@/lib/quick-add";
import { isLive } from "@/lib/projects";
import { timeLabel } from "@/lib/format";
import { dueTone, priorityLabel } from "@/lib/today";
import { setReminderAction } from "@/app/actions/tasks";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Button, fieldClass, stop, useEscape } from "@/components/ui/primitives";
import { IconBell, IconCalendar, IconClose, IconFlag, IconPlus } from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";
import { Emoji, ProjectPicker } from "../projects/project-bits";
import { useProjects } from "../projects/use-projects";
import { priorityColors } from "./task-bits";
import { ScheduleMenu, dateWords, priorityItems } from "./task-menus";
import type { useTasks } from "./use-tasks";

type Ops = ReturnType<typeof useTasks>;

/** Values picked with the chips; they win over what the title text says. */
type Picked = { date?: string | null; time?: string | null; priority?: number; project?: string | null; reminder?: string | null };

const TONE_TEXT = { overdue: "text-danger", today: "text-[#1f8a52]", tomorrow: "text-[#d9730d]", later: "text-[#7a5af8]" } as const;

const CHIP =
  "inline-flex h-8 min-w-0 shrink-0 items-center gap-1.5 rounded-[9px] px-2 text-[12.5px] font-medium shadow-ring transition hover:bg-gray-100 [@media(hover:none)]:h-10";

/** "+ Add task", the collapsed composer. */
export function AddTaskButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={stop}
      className={`group/add flex h-10 w-full items-center gap-2.5 text-left text-[14.5px] text-ink-3 transition-colors hover:text-accent ${className}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-accent transition-colors group-hover/add:bg-accent group-hover/add:text-white">
        <IconPlus size={16} strokeWidth={2} />
      </span>
      Add task
    </button>
  );
}

/**
 * Inline composer, as in Todoist: a title that understands "tomorrow 5pm p1
 * #Project" (recognised words get highlighted and land in the chips), a
 * description, chips for date, priority, reminder and project, and Cancel /
 * Add task. Enter adds and stays open for the next one; Esc closes.
 */
export function TaskComposer({
  ops,
  onClose,
  defaultDate = null,
  defaultProject = null,
  compact = false,
}: {
  ops: Ops;
  onClose: () => void;
  defaultDate?: string | null;
  defaultProject?: string | null;
  /** Dashboard cards: no description, icon chips, a smaller footer. */
  compact?: boolean;
}) {
  const { run } = useDashboard();
  const { areas, unsorted, index } = useProjects();
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState<Picked>({});
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const today = ops.today;
  useEscape(onClose);

  const projects = useMemo(
    () => [...areas.flatMap((a) => a.projects), ...unsorted].filter(isLive).map((p) => ({ id: p.id, name: p.name })),
    [areas, unsorted],
  );
  const parsed = useMemo(() => parseQuickAdd(text, { today, projects }), [text, today, projects]);
  const date = picked.date !== undefined ? picked.date : (parsed.due_date ?? defaultDate);
  const time = picked.time !== undefined ? picked.time : (parsed.due_time ?? null);
  const priority = picked.priority ?? parsed.priority ?? 0;
  const project = picked.project !== undefined ? picked.project : (parsed.project_id ?? defaultProject);
  const reminder = picked.reminder ?? null;
  const fromText = {
    date: picked.date === undefined && !!parsed.due_date,
    priority: picked.priority === undefined && parsed.priority !== undefined,
    project: picked.project === undefined && !!parsed.project_id,
  };

  // The title grows with its text so the highlight layer lines up underneath.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  useEffect(() => input.current?.focus({ preventScroll: false }), []);

  const submit = async () => {
    if (!parsed.title || busy) return;
    setBusy(true);
    const task = await ops.create({
      title: parsed.title,
      notes: notes.trim() || null,
      due_date: date,
      due_time: date ? time : null,
      priority,
      project,
    });
    if (task && reminder) {
      const on = date && date > today ? date : today;
      await run(setReminderAction({ task_id: task.id, schedule: { type: "once", date: on, time: reminder }, until: "once" }));
    }
    setBusy(false);
    if (!task) return;
    setText("");
    setNotes("");
    setPicked({});
    input.current?.focus();
  };

  const set = (p: Picked) => setPicked((v) => ({ ...v, ...p }));
  const entry = project ? index.get(project) : undefined;
  const dateText = date ? [dateWords(date, today).replace(/^./, (c) => c.toUpperCase()), timeLabel(time)].filter(Boolean).join(" ") : null;

  const reminderItems: MenuItem[] = [
    ...(time ? [{ label: "At the task's time", hint: timeLabel(time) ?? "", checked: reminder === time, onSelect: () => set({ reminder: time }) }] : []),
    ...["09:00", "12:00", "18:00"].map((t) => ({ label: `At ${timeLabel(t)}`, checked: reminder === t, onSelect: () => set({ reminder: t }) })),
    ...(reminder ? [{ divider: true } as const, { label: "No reminder", icon: <IconClose size={15} />, onSelect: () => set({ reminder: null }) }] : []),
  ];

  const chips = (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <ScheduleMenu
        today={today}
        value={date}
        time={time}
        align="start"
        label="Date"
        onPick={(d, t) => set(t !== undefined ? { date: d, time: t } : { date: d })}
        className={`${CHIP} ${date ? TONE_TEXT[dueTone(date, today)] : "text-gray-600"} ${fromText.date ? "bg-accent-soft" : ""}`}
      >
        <IconCalendar size={14} />
        <span className="truncate">{dateText ?? "Date"}</span>
      </ScheduleMenu>
      <Menu
        label="Priority"
        align="start"
        items={priorityItems(priority, (p) => set({ priority: p }))}
        className={`${CHIP} text-gray-600 ${fromText.priority ? "bg-accent-soft" : ""}`}
      >
        <IconFlag
          size={14}
          style={{ color: priority ? priorityColors(priority).ring : undefined }}
          fill={priority ? priorityColors(priority).ring : "none"}
        />
        {priority ? priorityLabel(priority) : compact ? null : "Priority"}
      </Menu>
      <Menu
        label="Reminder"
        align="start"
        items={reminderItems}
        className={`${CHIP} ${reminder ? "text-accent-hover" : "text-gray-600"}`}
        footer={(close) => <ReminderTime value={reminder} onSet={(t) => (close(), set({ reminder: t }))} />}
      >
        <IconBell size={14} />
        {reminder ? timeLabel(reminder) : compact ? null : "Reminder"}
      </Menu>
      <button
        type="button"
        aria-label="Project"
        onClick={() => setPicking(true)}
        className={`${CHIP} max-w-[180px] text-gray-600 ${fromText.project ? "bg-accent-soft" : ""}`}
      >
        <Emoji emoji={entry?.project.emoji} size={13} />
        {entry ? <span className="truncate">{entry.project.name}</span> : compact ? null : "Project"}
      </button>
      <ProjectPicker open={picking} onClose={() => setPicking(false)} value={project} onChange={(id) => set({ project: id })} />
    </div>
  );

  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      className={`rounded-[14px] bg-surface shadow-[0_0_0_1px_var(--gray-250)] transition-shadow focus-within:shadow-[0_0_0_1px_var(--gray-400)] ${
        compact ? "p-2.5" : "p-3"
      }`}
    >
      <div className="relative">
        {/* Highlights sit under the transparent-backed textarea, matched glyph for glyph. */}
        <div aria-hidden className={`pointer-events-none absolute inset-0 whitespace-pre-wrap break-words text-transparent ${TITLE}`}>
          <Highlights text={text} tokens={parsed.tokens} />
        </div>
        <textarea
          ref={input}
          value={text}
          rows={1}
          maxLength={500}
          placeholder={compact ? "Task name" : "Task name, like “Call the bank tomorrow 5pm p1”"}
          aria-label="Task name"
          onChange={(e) => setText(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          className={`relative block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-ink-3 ${TITLE}`}
        />
      </div>
      {!compact && (
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Description"
          aria-label="Description"
          className="mt-0.5 block w-full bg-transparent text-[13px] leading-[20px] text-ink-2 outline-none placeholder:text-ink-3"
        />
      )}
      <div className={compact ? "mt-2 flex items-end gap-2" : "mt-3"}>
        <div className="min-w-0 flex-1">{chips}</div>
        <Footer compact={compact}>
          <Button size="sm" variant="ghost" onClick={onClose} className="[@media(hover:none)]:h-10" aria-label={compact ? "Cancel" : undefined}>
            {compact ? <IconClose size={15} /> : "Cancel"}
          </Button>
          <Button size="sm" variant="primary" disabled={!parsed.title || busy} onClick={() => void submit()} className="[@media(hover:none)]:h-10">
            {compact ? "Add" : "Add task"}
          </Button>
        </Footer>
      </div>
    </div>
  );
}

const TITLE = "text-[15px] font-medium leading-[22px] tracking-normal";

function Footer({ compact, children }: { compact: boolean; children: ReactNode }) {
  if (compact) return <div className="flex shrink-0 items-center gap-1">{children}</div>;
  return <div className="-mx-3 mt-3 flex items-center justify-end gap-2 border-t border-gray-150 px-3 pt-3">{children}</div>;
}

function Highlights({ text, tokens }: { text: string; tokens: { start: number; end: number }[] }) {
  const out: ReactNode[] = [];
  let at = 0;
  for (const t of tokens) {
    out.push(text.slice(at, t.start));
    out.push(
      <mark key={t.start} className="rounded-[4px] bg-accent-soft text-transparent [box-decoration-break:clone]">
        {text.slice(t.start, t.end)}
      </mark>,
    );
    at = t.end;
  }
  out.push(text.slice(at));
  // A trailing space would collapse without something after it.
  return (
    <>
      {out}
      {"​"}
    </>
  );
}

function ReminderTime({ value, onSet }: { value: string | null; onSet: (t: string) => void }) {
  const [t, setT] = useState(value ?? "");
  return (
    <form
      className="mx-1 mt-1 flex gap-1.5 border-t border-gray-150 px-1 pb-1 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (t) onSet(t);
      }}
    >
      <input type="time" aria-label="Reminder time" value={t} onChange={(e) => setT(e.target.value)} className={`${fieldClass} min-w-0 flex-1`} />
      <Button type="submit" size="sm" variant="dark" disabled={!t} className="h-10">
        Set
      </Button>
    </form>
  );
}
