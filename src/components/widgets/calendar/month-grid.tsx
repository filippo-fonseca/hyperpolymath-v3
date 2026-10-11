"use client";

import type { CalendarEvent } from "@/lib/dashboard-types";
import { addDays } from "@/lib/time";
import { dayOfMonth, shortDate, WEEKDAY_LETTERS, WEEKDAYS_SHORT } from "@/lib/format";
import { eventSpan, eventTime } from "./calendar-utils";

// Six-week month grid. Each day shows up to three chips and an "N more"
// line; tapping a day opens the week grid on it.

const MAX_CHIPS = 3;

export function MonthGrid({
  from,
  month,
  events,
  tz,
  today,
  onPickDay,
}: {
  from: string;
  /** "YYYY-MM" of the month being shown. */
  month: string;
  events: CalendarEvent[];
  tz: string;
  today: string;
  onPickDay: (day: string) => void;
}) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const { first, last } = eventSpan(e, tz);
    for (let d = first < from ? from : first; d <= last && d <= days[41]; d = addDays(d, 1)) {
      byDay.set(d, [...(byDay.get(d) ?? []), e]);
    }
  }

  return (
    <div className="overflow-hidden rounded-[18px] bg-surface shadow-ring">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div key={w} className="py-2 text-center text-[11.5px] font-semibold text-gray-500">
            <span className="sm:hidden">{WEEKDAY_LETTERS[i]}</span>
            <span className="hidden sm:inline">{w}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = d.startsWith(month);
          const isToday = d === today;
          const list = byDay.get(d) ?? [];
          const more = list.length - MAX_CHIPS;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPickDay(d)}
              aria-label={`${shortDate(d)}, ${list.length ? `${list.length} event${list.length === 1 ? "" : "s"}` : "no events"}`}
              className={`flex min-h-[84px] min-w-0 flex-col gap-[3px] px-[3px] pb-1.5 pt-1 text-left transition-colors hover:bg-gray-100 sm:min-h-[108px] sm:px-1.5 ${
                i % 7 ? "border-l border-gray-150" : ""
              } ${i >= 7 ? "border-t border-gray-150" : ""} ${inMonth ? "" : "bg-gray-50"}`}
            >
              <span
                className={`mb-0.5 flex h-[22px] min-w-[22px] items-center justify-center self-center rounded-full px-1 text-[12.5px] tabular-nums sm:self-start ${
                  isToday ? "bg-accent font-semibold text-white" : inMonth ? "font-medium text-ink" : "font-medium text-ink-3"
                }`}
              >
                {dayOfMonth(d)}
              </span>
              {list.slice(0, MAX_CHIPS).map((e) => (
                <MonthChip key={e.id} e={e} tz={tz} dim={!inMonth} />
              ))}
              {more > 0 && <span className="truncate px-0.5 text-[10.5px] font-medium text-gray-500 sm:text-[11px]">{more} more</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthChip({ e, tz, dim }: { e: CalendarEvent; tz: string; dim: boolean }) {
  const color = e.color ?? "var(--accent)";
  if (e.all_day) {
    return (
      <span
        className={`overflow-hidden whitespace-nowrap rounded-[5px] px-1 py-px sm:text-ellipsis text-[10.5px] font-medium leading-[1.35] text-ink sm:text-[11px] ${dim ? "opacity-60" : ""}`}
        style={{ background: `color-mix(in srgb, ${color} 14%, white)` }}
      >
        {e.title}
      </span>
    );
  }
  return (
    <span className={`flex min-w-0 items-center gap-1 px-0.5 text-[10.5px] leading-[1.35] text-ink sm:text-[11px] ${dim ? "opacity-60" : ""}`}>
      {e.task_id ? (
        <span className="h-[7px] w-[7px] shrink-0 rounded-[2px] border-[1.25px] border-gray-500" aria-hidden />
      ) : (
        <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      )}
      <span className="hidden shrink-0 tabular-nums text-ink-3 sm:inline">{eventTime(e.start, tz)}</span>
      <span className="overflow-hidden whitespace-nowrap font-medium sm:text-ellipsis">{e.title}</span>
    </span>
  );
}
