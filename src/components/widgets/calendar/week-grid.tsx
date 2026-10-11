"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { CalendarEvent } from "@/lib/dashboard-types";
import { addDays } from "@/lib/time";
import { dayOfMonth, timeLabel, WEEKDAYS_SHORT } from "@/lib/format";
import { allDayOn, daySegments, eventTime, layoutDay, minutesInDay, type Placed, type Segment } from "./calendar-utils";

// Apple / Notion Calendar style time grid: sticky day header with an
// all-day row, hour gutter on the left, events as tinted rounded blocks.

export const HOUR = 48;
const GUTTER = 48;
const DAY_MIN = 24 * 60;
const MIN_BLOCK = 20;
/** Shortest visual length in minutes (task pills are 22px tall). */
const MIN_SPAN = Math.ceil((24 / HOUR) * 60);

export function WeekGrid({
  from,
  events,
  tz,
  today,
  nowMs,
}: {
  from: string;
  events: CalendarEvent[];
  tz: string;
  today: string;
  nowMs: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const allDay = days.map((d) => allDayOn(events, d, tz));
  const allDayRows = Math.max(0, ...allDay.map((l) => l.length));
  const nowMin = minutesInDay(new Date(nowMs).toISOString(), tz);
  const showsToday = days.includes(today);

  // Open on the working day (7am at the top), or on now if it's later than that view reaches.
  const opened = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || opened.current) return;
    opened.current = true;
    const nowY = (nowMin / 60) * HOUR;
    const sevenAm = 7 * HOUR - 6;
    el.scrollTop = showsToday && nowY > sevenAm + el.clientHeight * 0.75 ? nowY - el.clientHeight / 3 : sevenAm;
  }, [nowMin, showsToday]);

  return (
    <div
      ref={scrollRef}
      className="relative h-[min(680px,calc(100dvh-230px))] min-h-[380px] overflow-auto overscroll-contain rounded-[18px] bg-surface shadow-ring [container-type:inline-size]"
    >
      <div className="w-max min-w-full" style={{ "--col": `calc((100cqw - ${GUTTER}px) / 7)` } as CSSProperties}>
        {/* Day header + all-day row */}
        <div className="sticky top-0 z-20 flex border-b border-gray-200 bg-surface/95 backdrop-blur-sm">
          <div className="sticky left-0 z-10 flex shrink-0 flex-col justify-end bg-surface/95 pb-1.5 pr-1.5 text-right" style={{ width: GUTTER }}>
            {allDayRows > 0 && <span className="text-[10.5px] font-medium text-gray-500">all-day</span>}
          </div>
          {days.map((d, i) => {
            const isToday = d === today;
            return (
              <div key={d} className="w-[var(--col)] shrink-0 border-l border-gray-150 px-1 pb-1.5 pt-2">
                <div className="flex items-center justify-center gap-1.5">
                  <span className={`text-[12px] font-medium ${isToday ? "text-accent" : "text-gray-500"}`}>{WEEKDAYS_SHORT[i]}</span>
                  <span
                    className={`flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-1 text-[15px] tabular-nums ${
                      isToday ? "bg-accent font-semibold text-white" : "font-medium text-ink"
                    }`}
                  >
                    {dayOfMonth(d)}
                  </span>
                </div>
                {allDayRows > 0 && (
                  <div className="mt-1.5 flex flex-col gap-[3px]">
                    {allDay[i].map((e) => (
                      <AllDayChip key={e.id} e={e} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Hours */}
        <div className="flex">
          <div className="sticky left-0 z-10 shrink-0 bg-surface" style={{ width: GUTTER, height: 24 * HOUR }}>
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span
                key={h}
                className={`absolute right-2 -translate-y-1/2 text-[10.5px] font-medium tabular-nums text-gray-500 ${
                  showsToday && Math.abs(h * 60 - nowMin) < 12 ? "opacity-0" : ""
                }`}
                style={{ top: h * HOUR }}
              >
                {timeLabel(`${String(h).padStart(2, "0")}:00`)}
              </span>
            ))}
            {showsToday && (
              <span
                className="absolute right-1 -translate-y-1/2 rounded-full bg-danger px-1.5 py-px text-[10px] font-semibold tabular-nums text-white"
                style={{ top: (nowMin / 60) * HOUR }}
              >
                {eventTime(new Date(nowMs).toISOString(), tz)}
              </span>
            )}
          </div>
          {days.map((d) => (
            <DayColumn key={d} today={d === today} nowMin={nowMin} segments={daySegments(events, d, tz)} tz={tz} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ today, nowMin, segments, tz }: { today: boolean; nowMin: number; segments: Segment[]; tz: string }) {
  return (
    <div
      className={`relative w-[var(--col)] shrink-0 border-l border-gray-150 ${today ? "bg-[rgb(16_132_254/0.03)]" : ""}`}
      style={{
        height: 24 * HOUR,
        backgroundImage: `repeating-linear-gradient(to bottom, var(--gray-150) 0, var(--gray-150) 1px, transparent 1px, transparent ${HOUR}px)`,
      }}
    >
      {layoutDay(segments, MIN_SPAN).map((p) => (
        <EventBlock key={p.e.id} s={p} tz={tz} />
      ))}
      {today && (
        <div className="pointer-events-none absolute inset-x-0 z-[5] -translate-y-1/2" style={{ top: (nowMin / 60) * HOUR }} aria-hidden>
          <div className="relative h-[2px] bg-danger">
            <span className="absolute -left-[5px] top-1/2 h-[9px] w-[9px] -translate-y-1/2 rounded-full bg-danger" />
          </div>
        </div>
      )}
    </div>
  );
}

const tint = (color: string | null) => `color-mix(in srgb, ${color ?? "var(--accent)"} 13%, white)`;

function EventBlock({ s, tz }: { s: Placed; tz: string }) {
  const { e } = s;
  const top = (s.start / 60) * HOUR;
  const height = Math.max(((Math.min(s.end, DAY_MIN) - s.start) / 60) * HOUR, MIN_BLOCK);
  const pos: CSSProperties = {
    top: top + 1,
    height: height - 2,
    left: `calc(${(s.col / s.cols) * 100}% + 2px)`,
    width: `calc(${100 / s.cols}% - ${s.cols > 1 ? 3 : 5}px)`,
  };

  if (e.task_id) {
    return (
      <div
        className="absolute flex h-[22px] items-center gap-1 overflow-hidden rounded-full bg-white px-1.5 text-[11.5px] font-medium text-ink shadow-ring"
        style={{ ...pos, height: 22 }}
        title={e.title}
      >
        <span className="h-[10px] w-[10px] shrink-0 rounded-[3px] border-[1.5px] border-gray-500" aria-hidden />
        <span className="truncate">{e.title}</span>
      </div>
    );
  }

  const short = height < 36;
  return (
    <div
      className="absolute overflow-hidden rounded-[8px] px-1.5 py-[3px] text-ink"
      style={{ ...pos, background: tint(e.color), boxShadow: `inset 3px 0 0 ${e.color ?? "var(--accent)"}` }}
      title={e.title}
    >
      <div className={`pl-1 text-[11.5px] leading-[1.25] ${short ? "flex gap-1 truncate" : ""}`}>
        <span className="font-semibold">{e.title}</span>
        <span className={`text-ink-2 tabular-nums ${short ? "" : "block"}`}>{eventTime(e.start, tz)}</span>
      </div>
    </div>
  );
}

function AllDayChip({ e }: { e: CalendarEvent }) {
  return (
    <div
      className="truncate rounded-[6px] px-1.5 py-[2px] text-[11px] font-medium text-ink"
      style={{ background: tint(e.color), boxShadow: `inset 3px 0 0 ${e.color ?? "var(--accent)"}` }}
      title={e.title}
    >
      <span className="pl-0.5">{e.title}</span>
    </div>
  );
}
