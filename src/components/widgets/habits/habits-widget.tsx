"use client";

import type { Habit } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { WEEKDAY_LETTERS } from "@/lib/format";
import { Eyebrow, stop } from "@/components/ui/primitives";
import { KiwiWatering } from "@/components/illustrations";
import { Ring } from "./ring";
import { useHabits } from "./use-habits";

/** Strava-style rings: one aggregate ring plus tappable mini rings. */
export function HabitsWidget({ size }: { size: WidgetSize }) {
  const { habits, scheduled, today, progressOn, cycle } = useHabits();
  const total = scheduled.length * 3;
  const sum = scheduled.reduce((a, h) => a + progressOn(h, today), 0);
  const doneCount = scheduled.filter((h) => progressOn(h, today) >= 3).length;

  if (!habits.length) {
    return (
      <div className="flex h-full flex-col">
        <Eyebrow>Habits</Eyebrow>
        {size === "s" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Ring size={64} stroke={8} value={0} />
            <div className="mt-2 text-[13px] text-ink-3">Tap to add your first habit</div>
          </div>
        ) : (
          <div className={`flex flex-1 items-center justify-center ${size === "l" ? "flex-col gap-1 text-center" : "gap-3"}`}>
            <KiwiWatering size={size === "l" ? 132 : 84} className="shrink-0" />
            <div className="text-[13px] text-ink-3">Tap to add your first habit</div>
          </div>
        )}
      </div>
    );
  }

  const aggregate = (
    <Ring size={size === "s" ? 92 : 104} stroke={10} value={total ? sum / total : 0}>
      <span className="text-center leading-none">
        <span className="block text-[26px] font-light tabular-nums tracking-[-0.02em]">
          {doneCount}
          <span className="text-ink-3">/{scheduled.length}</span>
        </span>
      </span>
    </Ring>
  );

  if (size === "s") {
    return (
      <div className="flex h-full flex-col">
        <Eyebrow>Habits</Eyebrow>
        <div className="flex flex-1 items-center justify-center">{aggregate}</div>
      </div>
    );
  }

  const list = scheduled.length ? scheduled : habits;

  if (size === "m") {
    return (
      <div className="flex h-full flex-col">
        <Eyebrow>Habits</Eyebrow>
        <div className="flex min-h-0 flex-1 items-center gap-5">
          {aggregate}
          <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
            {list.slice(0, 3).map((h) => (
              <MiniRow key={h.id} habit={h} progress={progressOn(h, today)} onCycle={() => cycle(h)} />
            ))}
            {list.length > 3 && <li className="pl-[38px] text-[12px] text-gray-500">{list.length - 3} more</li>}
          </ul>
        </div>
      </div>
    );
  }

  // Large: grid of mini rings plus a 7-day strip.
  const week = habits[0].week;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Habits</Eyebrow>
        <span className="text-[12px] font-medium tabular-nums text-gray-500">
          {doneCount} of {scheduled.length} today
        </span>
      </div>
      <div className="mt-3 flex items-center justify-center">{aggregate}</div>
      <ul className="mt-4 grid min-h-0 flex-1 grid-cols-2 content-start gap-x-3 gap-y-2 overflow-hidden">
        {list.slice(0, 8).map((h) => (
          <MiniRow key={h.id} habit={h} progress={progressOn(h, today)} onCycle={() => cycle(h)} />
        ))}
      </ul>
      <div className="mt-2 flex justify-between px-1">
        {week.map((d, i) => {
          const sched = habits.filter((h) => h.week[i]?.scheduled);
          const frac = sched.length
            ? sched.reduce((a, h) => a + (d.date === today ? progressOn(h, today) : h.week[i].progress), 0) / (sched.length * 3)
            : 0;
          const future = d.date > today;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className={`text-[10.5px] font-semibold ${d.date === today ? "text-accent" : "text-gray-400"}`}>
                {WEEKDAY_LETTERS[i]}
              </span>
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: future || frac === 0 ? "var(--gray-200)" : frac >= 1 ? "var(--accent)" : "rgb(16 132 254 / 0.4)",
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniRow({ habit, progress, onCycle }: { habit: Habit; progress: number; onCycle: () => void }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCycle();
        }}
        onPointerDown={stop}
        aria-label={`${habit.name}: ${progress} of 3. Tap to advance.`}
        className="rounded-full transition active:scale-90"
      >
        <Ring size={28} stroke={4.5} value={progress / 3} />
      </button>
      <span className={`min-w-0 truncate text-[14px] font-medium ${progress >= 3 ? "text-ink-3" : ""}`}>{habit.name}</span>
    </li>
  );
}
