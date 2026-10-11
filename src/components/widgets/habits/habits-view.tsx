"use client";

import { useState } from "react";
import type { Habit } from "@/lib/dashboard-types";
import { WEEKDAY_LETTERS, WEEKDAYS_SHORT, pluralize } from "@/lib/format";
import { createHabitAction, updateHabitAction } from "@/app/actions/habits";
import { Button, IconButton, WeekdayPicker, fieldClass } from "@/components/ui/primitives";
import { IconPencil, IconPlus } from "@/components/ui/icons";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { useDashboard } from "@/components/dashboard/context";
import { Ring } from "./ring";
import { useHabits } from "./use-habits";

const ALL = [0, 1, 2, 3, 4, 5, 6];

export function HabitsView() {
  const { habits, scheduled, today, progressOn } = useHabits();
  const [adding, setAdding] = useState(false);
  const doneCount = scheduled.filter((h) => progressOn(h, today) >= 3).length;

  return (
    <div>
      <ExpandedHeader
        eyebrow={scheduled.length ? `${doneCount} of ${scheduled.length} done today` : "Habits"}
        title="Habits"
        aside={
          !adding && (
            <Button size="sm" variant="soft" onClick={() => setAdding(true)}>
              <IconPlus size={15} /> New habit
            </Button>
          )
        }
      />
      {adding && <HabitForm onDone={() => setAdding(false)} />}
      {habits.length === 0 && !adding && (
        <div className="py-12 text-center">
          <div className="text-[15px] font-medium">No habits yet</div>
          <p className="mt-1 text-[14px] text-ink-3">Add one, then tap its ring to log progress in quarters to done.</p>
        </div>
      )}
      <ul className="flex flex-col divide-y divide-gray-150">
        {habits.map((h) => (
          <HabitRow key={h.id} habit={h} />
        ))}
      </ul>
      {habits.length > 0 && (
        <p className="mt-6 text-[13px] text-ink-3">Tap a ring to step through started, almost, done, and back to empty.</p>
      )}
    </div>
  );
}

function HabitRow({ habit }: { habit: Habit }) {
  const { today, progressOn, cycle } = useHabits();
  const [editing, setEditing] = useState(false);

  if (editing) return <HabitForm habit={habit} onDone={() => setEditing(false)} />;

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold">{habit.name}</div>
          <div className="text-[13px] text-gray-500">
            {habit.streak > 0 ? `${pluralize(habit.streak, "day")} streak` : "No streak yet"}
            {habit.days_of_week.length < 7 && ` · ${habit.days_of_week.map((d) => WEEKDAYS_SHORT[d]).join(", ")}`}
          </div>
        </div>
        <IconButton label="Edit habit" className="ml-auto h-8 w-8 sm:ml-1" onClick={() => setEditing(true)}>
          <IconPencil size={15} />
        </IconButton>
      </div>
      <div className="flex justify-between gap-1.5 sm:justify-end sm:gap-2.5">
        {habit.week.map((d, i) => {
          const future = d.date > today;
          const p = progressOn(habit, d.date);
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className={`text-[11px] font-semibold ${d.date === today ? "text-accent" : "text-gray-400"}`}>
                {WEEKDAY_LETTERS[i]}
              </span>
              <button
                type="button"
                disabled={future}
                onClick={() => cycle(habit, d.date)}
                aria-label={`${habit.name} on ${d.date}: ${p} of 3`}
                className={`rounded-full transition active:scale-90 disabled:opacity-35 ${d.scheduled ? "" : "opacity-45"}`}
              >
                <Ring size={34} stroke={5} value={p / 3} muted={!d.scheduled} />
              </button>
            </div>
          );
        })}
      </div>
    </li>
  );
}

function HabitForm({ habit, onDone }: { habit?: Habit; onDone: () => void }) {
  const { run } = useDashboard();
  const [name, setName] = useState(habit?.name ?? "");
  const [days, setDays] = useState<number[]>(habit?.days_of_week ?? ALL);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const res = habit
      ? await run(updateHabitAction(habit.id, { name: name.trim(), days_of_week: days }))
      : await run(createHabitAction({ name: name.trim(), days_of_week: days }));
    setBusy(false);
    if (res) onDone();
  };

  const archive = async () => {
    if (!habit) return;
    setBusy(true);
    const res = await run(updateHabitAction(habit.id, { archived: true }), { success: `Archived “${habit.name}”` });
    setBusy(false);
    if (res) onDone();
  };

  return (
    <div className="my-3 rounded-[18px] bg-gray-50 p-4 shadow-ring">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-3"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Habit name, e.g. Read 20 pages"
          maxLength={120}
          className={fieldClass}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <WeekdayPicker value={days} onChange={setDays} />
          <div className="flex gap-2">
            {habit && (
              <Button size="sm" variant="ghost" onClick={archive} disabled={busy}>
                Archive
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
            <Button size="sm" variant="dark" type="submit" disabled={busy || !name.trim()}>
              {habit ? "Save" : "Add habit"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
