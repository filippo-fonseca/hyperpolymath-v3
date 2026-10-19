"use client";

import type { Habit } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { WEEKDAY_LETTERS, pluralize } from "@/lib/format";
import { stop, useFitCount } from "@/components/ui/primitives";
import { IconPlus } from "@/components/ui/icons";
import { KiwiWatering } from "@/components/illustrations";
import { HeaderAction, WidgetHeader, useWidgetFrame } from "@/components/dashboard/widget-chrome";
import { Ring } from "./ring";
import { useHabits } from "./use-habits";

/** Strava-style rings: one aggregate ring plus tappable mini rings, and a week grid when wide. */
export function HabitsWidget({ size }: { size: WidgetSize }) {
  const { habits, scheduled, today, progressOn, cycle } = useHabits();
  const frame = useWidgetFrame();
  const [listRef, fit] = useFitCount<HTMLUListElement>(36, 4);
  const [rowsRef, rowFit] = useFitCount<HTMLUListElement>(34, 3);
  const total = scheduled.length * 3;
  const sum = scheduled.reduce((a, h) => a + progressOn(h, today), 0);
  const doneCount = scheduled.filter((h) => progressOn(h, today) >= 3).length;
  const best = habits.reduce<Habit | null>((b, h) => (!b || h.streak > b.streak ? h : b), null);
  const meta = scheduled.length ? `${doneCount} of ${scheduled.length} today` : habits.length ? "Rest day" : "";
  const addAction = frame && (
    <HeaderAction label="New habit" onClick={frame.open}>
      <IconPlus size={16} strokeWidth={2} />
    </HeaderAction>
  );

  if (!habits.length) {
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader actions={addAction} />
        {size === "s" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Ring size={64} stroke={8} value={0} />
            <div className="mt-2 text-[13px] text-ink-3">Tap to add your first habit</div>
          </div>
        ) : (
          <div className={`flex flex-1 items-center justify-center ${size === "m" ? "gap-3" : "flex-col gap-1 text-center"}`}>
            <KiwiWatering size={size === "m" ? 84 : 132} className="shrink-0" />
            <div>
              <div className="text-[15px] font-medium">Build a habit</div>
              <div className="mt-0.5 max-w-[240px] text-[13px] text-ink-3">Pick the days, tap the ring as you go. Streaks only count scheduled days.</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const aggregate = (ring: number) => (
    <Ring size={ring} stroke={ring > 96 ? 11 : 10} value={total ? sum / total : 0}>
      <span className="text-center leading-none">
        <span className="block text-[26px] font-light tabular-nums tracking-[-0.02em]">
          {doneCount}
          <span className="text-ink-3">/{scheduled.length}</span>
        </span>
        <span className="mt-1 block text-[10.5px] font-semibold text-gray-500">today</span>
      </span>
    </Ring>
  );

  if (size === "s") {
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader />
        <div className="flex flex-1 items-center justify-center">{aggregate(92)}</div>
        {best && best.streak > 1 && (
          <div className="truncate text-center text-[12px] text-ink-3">
            {best.name}: {pluralize(best.streak, "day")}
          </div>
        )}
      </div>
    );
  }

  const list = scheduled.length ? scheduled : habits;

  if (size === "m") {
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader meta={meta} actions={addAction} />
        <div className="flex min-h-0 flex-1 items-center gap-5">
          {aggregate(96)}
          {/* As many rows as the card has room for, with a line for the rest. */}
          <ul ref={rowsRef} className="flex h-full min-h-0 min-w-0 flex-1 flex-col justify-center gap-1.5 overflow-hidden">
            {(() => {
              const room = Math.max(1, rowFit);
              const shown = list.length > room ? list.slice(0, Math.max(1, room - 1)) : list;
              return (
                <>
                  {shown.map((h) => (
                    <MiniRow key={h.id} habit={h} progress={progressOn(h, today)} onCycle={() => cycle(h)} />
                  ))}
                  {list.length > shown.length && <li className="pl-[38px] text-[12px] text-gray-500">{list.length - shown.length} more</li>}
                </>
              );
            })()}
          </ul>
        </div>
      </div>
    );
  }

  const week = habits[0].week;
  const weekFrac = (i: number, d: { date: string }) => {
    const sched = habits.filter((h) => h.week[i]?.scheduled);
    return sched.length
      ? sched.reduce((a, h) => a + (d.date === today ? progressOn(h, today) : h.week[i].progress), 0) / (sched.length * 3)
      : 0;
  };
  // This week so far, over scheduled days only.
  let got = 0;
  let slots = 0;
  week.forEach((d, i) => {
    if (d.date > today) return;
    for (const h of habits) {
      if (!h.week[i]?.scheduled) continue;
      slots += 3;
      got += d.date === today ? progressOn(h, today) : h.week[i].progress;
    }
  });
  const weekPct = slots ? Math.round((got / slots) * 100) : 0;

  const stats = (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Stat label="This week" value={`${weekPct}%`} />
      <Stat label="Best streak" value={best ? pluralize(best.streak, "day") : "None"} hint={best && best.streak > 0 ? best.name : undefined} />
    </dl>
  );

  if (size === "w") {
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader meta={meta} actions={addAction} />
        <div className="mt-1 flex min-h-0 flex-1 gap-8">
          <div className="flex w-[200px] shrink-0 flex-col items-center justify-center gap-4">
            {aggregate(116)}
            {stats}
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_repeat(7,32px)_52px] items-center gap-x-1.5 pb-1 text-[11px] font-semibold text-gray-400">
              <span>Habit</span>
              {week.map((d, i) => (
                <span key={d.date} className={`text-center ${d.date === today ? "text-accent" : ""}`}>
                  {WEEKDAY_LETTERS[i]}
                </span>
              ))}
              <span className="text-right">Streak</span>
            </div>
            <ul ref={listRef} className="min-h-0 flex-1 overflow-hidden">
              {habits.slice(0, Math.max(1, fit)).map((h) => (
                <li key={h.id} className="grid h-9 grid-cols-[minmax(0,1fr)_repeat(7,32px)_52px] items-center gap-x-1.5">
                  <span className="truncate text-[14px] font-medium">{h.name}</span>
                  {h.week.map((d) => {
                    const p = progressOn(h, d.date);
                    const future = d.date > today;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        disabled={future}
                        onPointerDown={stop}
                        onClick={(e) => {
                          e.stopPropagation();
                          void cycle(h, d.date);
                        }}
                        aria-label={`${h.name}, ${d.date}: ${p} of 3`}
                        className={`flex justify-center rounded-full transition active:scale-90 disabled:opacity-40 ${d.scheduled ? "" : "opacity-35"}`}
                      >
                        <Ring size={22} stroke={3.5} value={p / 3} />
                      </button>
                    );
                  })}
                  <span className="text-right text-[12.5px] tabular-nums text-gray-500">{h.streak ? `${h.streak}d` : ""}</span>
                </li>
              ))}
            </ul>
            {habits.length > fit && <div className="pt-1 text-[12px] text-gray-500">{habits.length - fit} more</div>}
          </div>
        </div>
      </div>
    );
  }

  // Large: aggregate ring with stats, a grid of mini rings, and a 7-day strip.
  return (
    <div className="flex h-full flex-col">
      <WidgetHeader meta={meta} actions={addAction} />
      <div className="mt-2 flex items-center gap-5">
        {aggregate(104)}
        <div className="min-w-0 flex-1">{stats}</div>
      </div>
      <ul className="mt-4 grid min-h-0 flex-1 grid-cols-2 content-start gap-x-3 gap-y-2 overflow-hidden">
        {list.slice(0, 8).map((h) => (
          <MiniRow key={h.id} habit={h} progress={progressOn(h, today)} onCycle={() => cycle(h)} />
        ))}
      </ul>
      <div className="mt-2 flex justify-between px-1">
        {week.map((d, i) => {
          const frac = weekFrac(i, d);
          const future = d.date > today;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className={`text-[10.5px] font-semibold ${d.date === today ? "text-accent" : "text-gray-400"}`}>{WEEKDAY_LETTERS[i]}</span>
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium text-gray-500">{label}</dt>
      <dd className="truncate text-[17px] font-semibold tabular-nums tracking-[-0.01em]">{value}</dd>
      {hint && <dd className="truncate text-[11.5px] text-ink-3">{hint}</dd>}
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
      <span className={`min-w-0 flex-1 truncate text-[14px] font-medium ${progress >= 3 ? "text-ink-3" : ""}`}>{habit.name}</span>
      {habit.streak > 1 && <span className="shrink-0 text-[11.5px] tabular-nums text-gray-500">{habit.streak}d</span>}
    </li>
  );
}
