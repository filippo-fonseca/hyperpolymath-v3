"use client";

import { useState } from "react";
import type { Habit } from "@/lib/dashboard-types";
import { WEEKDAY_LETTERS, WEEKDAYS_SHORT, pluralize } from "@/lib/format";
import { createHabitAction, updateHabitAction } from "@/app/actions/habits";
import { Button, IconButton, Segmented, WeekdayPicker, fieldClass } from "@/components/ui/primitives";
import { IconPencil, IconPlus } from "@/components/ui/icons";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { KiwiWatering } from "@/components/illustrations";
import { useDashboard } from "@/components/dashboard/context";
import { Ring } from "./ring";
import { useHabits } from "./use-habits";
import { selectClass, selectStyle } from "@/components/teammates/form";
import { Emoji } from "../projects/project-bits";
import { useProjects } from "../projects/use-projects";

const ALL = [0, 1, 2, 3, 4, 5, 6];

export function HabitsView() {
  const { habits, scheduled, today, progressOn } = useHabits();
  const { areas } = useProjects();
  const [adding, setAdding] = useState(false);
  const [byArea, setByArea] = useState(false);
  const doneCount = scheduled.filter((h) => progressOn(h, today) >= 3).length;
  const grouped = byArea && areas.length > 0;
  const groups = grouped
    ? [
        ...areas.map((a) => ({ key: a.id, title: a.name, emoji: a.emoji, habits: habits.filter((h) => h.area_id === a.id) })),
        {
          key: "none",
          title: "No area",
          emoji: null,
          habits: habits.filter((h) => !h.area_id || !areas.some((a) => a.id === h.area_id)),
        },
      ].filter((g) => g.habits.length)
    : [{ key: "all", title: "", emoji: null, habits }];

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
        <div className="flex flex-col items-center pb-10 text-center">
          <KiwiWatering size={148} />
          <div className="mt-1 text-[15px] font-medium">No habits yet</div>
          <p className="mt-1 text-[14px] text-ink-3">Add one, then tap its ring to log progress in quarters to done.</p>
        </div>
      )}
      {areas.length > 0 && habits.length > 0 && (
        <div className="mb-2 flex items-center justify-end gap-2">
          <span className="text-[12.5px] font-medium text-gray-500">Group by</span>
          <Segmented<"none" | "area">
            size="sm"
            value={byArea ? "area" : "none"}
            onChange={(v) => setByArea(v === "area")}
            options={[
              { value: "none", label: "None" },
              { value: "area", label: "Area" },
            ]}
          />
        </div>
      )}
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.key}>
            {grouped && (
              <h3 className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-gray-500">
                {g.emoji && <Emoji emoji={g.emoji} size={13} />}
                <span className="truncate">{g.title}</span>
                <span className="font-medium tabular-nums text-ink-3">{g.habits.length}</span>
              </h3>
            )}
            <ul className="flex flex-col divide-y divide-gray-150">
              {g.habits.map((h) => (
                <HabitRow key={h.id} habit={h} />
              ))}
            </ul>
          </section>
        ))}
      </div>
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
  const { areas } = useProjects();
  const [name, setName] = useState(habit?.name ?? "");
  const [days, setDays] = useState<number[]>(habit?.days_of_week ?? ALL);
  // An archived area isn't in the list; leave the habit's area alone unless it's changed here.
  const [initialArea] = useState(habit?.area_id && areas.some((a) => a.id === habit.area_id) ? habit.area_id : "");
  const [area, setArea] = useState(initialArea);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const res = habit
      ? await run(
          updateHabitAction(habit.id, {
            name: name.trim(),
            days_of_week: days,
            ...(area !== initialArea ? { area: area || null } : {}),
          }),
        )
      : await run(createHabitAction({ name: name.trim(), days_of_week: days, area: area || null }));
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
          className={`${fieldClass} w-full`}
        />
        {areas.length > 0 && (
          <select
            aria-label="Area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={`${selectClass} sm:max-w-[260px]`}
            style={selectStyle}
          >
            <option value="">No area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emoji ? `${a.emoji} ` : ""}
                {a.name}
              </option>
            ))}
          </select>
        )}
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
