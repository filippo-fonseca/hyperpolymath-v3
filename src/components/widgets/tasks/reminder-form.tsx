"use client";

import { useState } from "react";
import type { Schedule } from "@/lib/schedule";
import type { ReminderRow, Task } from "@/lib/dashboard-types";
import { describeSchedule, scheduleSchema } from "@/lib/schedule";
import { instantLabel } from "@/lib/format";
import { addDays } from "@/lib/time";
import { cancelReminderAction, setReminderAction } from "@/app/actions/tasks";
import { Button, IconButton, Segmented, WeekdayPicker, fieldClass } from "@/components/ui/primitives";
import { IconBell, IconClose, IconPlus } from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";

type Kind = "once" | "daily" | "interval";
type Until = "done" | "date" | "count";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Structured reminder picker: once, daily at times, or every N hours in a window. */
export function ReminderForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const { data, run } = useDashboard();
  const [kind, setKind] = useState<Kind>("once");
  const [date, setDate] = useState(task.due_date && task.due_date >= data.today ? task.due_date : data.today);
  const [time, setTime] = useState(task.due_time?.slice(0, 5) ?? "09:00");
  const [times, setTimes] = useState<string[]>(["10:00"]);
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [hours, setHours] = useState(3);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("21:00");
  const [until, setUntil] = useState<Until>("done");
  const [untilDate, setUntilDate] = useState(addDays(data.today, 7));
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);

  const schedule: Schedule =
    kind === "once"
      ? { type: "once", date, time }
      : kind === "daily"
        ? { type: "daily", times: [...new Set(times)].sort(), ...(days.length < 7 ? { days } : {}) }
        : {
            type: "interval",
            every_minutes: Math.max(5, Math.round(hours * 60)),
            window: { start, end },
            ...(days.length < 7 ? { days } : {}),
          };
  const valid = scheduleSchema.safeParse(schedule).success;

  const save = async () => {
    setBusy(true);
    const res = await run(
      setReminderAction({
        task_id: task.id,
        schedule,
        until: kind === "once" ? "once" : until,
        until_date: until === "date" ? untilDate : null,
        count: until === "count" ? count : null,
      }),
    );
    setBusy(false);
    if (res) onDone();
  };

  return (
    <div className="rounded-[16px] bg-gray-50 p-4 shadow-ring" onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[14px] font-semibold">
          <IconBell size={16} /> Remind me
        </span>
        <Segmented<Kind>
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: "once", label: "Once" },
            { value: "daily", label: "Daily" },
            { value: "interval", label: "Repeat" },
          ]}
        />
      </div>

      {kind === "once" && (
        <div className="flex gap-2">
          <input type="date" value={date} min={data.today} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${fieldClass} max-w-[130px]`} />
        </div>
      )}

      {kind === "daily" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="time"
                  value={t}
                  onChange={(e) => setTimes((ts) => ts.map((x, j) => (j === i ? e.target.value : x)))}
                  className={`${fieldClass} w-[118px]`}
                />
                {times.length > 1 && (
                  <IconButton label="Remove time" onClick={() => setTimes((ts) => ts.filter((_, j) => j !== i))} className="h-7 w-7">
                    <IconClose size={14} />
                  </IconButton>
                )}
              </div>
            ))}
            {times.length < 6 && (
              <Button size="sm" variant="ghost" onClick={() => setTimes((ts) => [...ts, "18:00"])}>
                <IconPlus size={14} /> Time
              </Button>
            )}
          </div>
          <WeekdayPicker value={days} onChange={setDays} />
        </div>
      )}

      {kind === "interval" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
            Every
            <input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) || 1)}
              className={`${fieldClass} w-[72px] text-center`}
            />
            hours from
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${fieldClass} w-[110px]`} />
            to
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${fieldClass} w-[110px]`} />
          </div>
          <WeekdayPicker value={days} onChange={setDays} />
        </div>
      )}

      {kind !== "once" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-2">Until</span>
          <Segmented<Until>
            size="sm"
            value={until}
            onChange={setUntil}
            options={[
              { value: "done", label: "Done" },
              { value: "date", label: "Date" },
              { value: "count", label: "Count" },
            ]}
          />
          {until === "date" && (
            <input type="date" value={untilDate} min={data.today} onChange={(e) => setUntilDate(e.target.value)} className={`${fieldClass} w-[150px]`} />
          )}
          {until === "count" && (
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
              className={`${fieldClass} w-[72px] text-center`}
            />
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[12.5px] text-ink-3">{valid ? describeSchedule(schedule) : "Check the times"}</span>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" disabled={!valid || busy} onClick={save}>
            Set reminder
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Active reminders for a task, each with a cancel button. */
export function TaskReminders({ taskId }: { taskId: string }) {
  const { data, run } = useDashboard();
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const list = data.reminders.filter((r) => r.task_id === taskId && r.active && !gone.has(r.id));
  if (!list.length) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {list.map((r) => (
        <ReminderChip
          key={r.id}
          r={r}
          tz={data.tz}
          today={data.today}
          onCancel={async () => {
            setGone((s) => new Set(s).add(r.id));
            const ok = await run(cancelReminderAction(r.id), { success: "Reminder cancelled" });
            if (!ok) setGone((s) => (s.delete(r.id), new Set(s)));
          }}
        />
      ))}
    </ul>
  );
}

function ReminderChip({ r, tz, today, onCancel }: { r: ReminderRow; tz: string; today: string; onCancel: () => void }) {
  const parsed = scheduleSchema.safeParse(r.schedule);
  const text = parsed.success ? describeSchedule(parsed.data) : "Reminder";
  const untilText = r.until_kind === "done" ? " until done" : r.until_kind === "date" && r.until_date ? ` until ${r.until_date}` : "";
  return (
    <li className="flex items-center gap-2 rounded-[12px] bg-accent-soft py-1.5 pl-3 pr-1 text-[13px] text-accent-hover">
      <IconBell size={14} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {text}
        {untilText}
        {r.next_fire_at && <span className="text-accent-hover/70"> · next {instantLabel(r.next_fire_at, tz, today)}</span>}
      </span>
      <IconButton label="Cancel reminder" onClick={onCancel} className="h-7 w-7 text-accent-hover hover:bg-white/60">
        <IconClose size={14} />
      </IconButton>
    </li>
  );
}
