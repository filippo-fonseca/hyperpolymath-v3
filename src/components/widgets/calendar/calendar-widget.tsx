"use client";

import { Suspense, use } from "react";
import type { CalendarData, CalendarEvent } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { dayOfMonth, shortDate, weekdayName } from "@/lib/format";
import { IconCalendar, IconPlus } from "@/components/ui/icons";
import { stop, useFitCount } from "@/components/ui/primitives";
import { useDashboard } from "@/components/dashboard/context";
import { eventDate, eventTime, groupByDay, isNow, remainingToday } from "./calendar-utils";

// Agenda widget (Outlook-style): accent weekday, big date numeral, rows of
// time | color bar | title. Isolated so its data source can change freely.

export function CalendarWidget({ size }: { size: WidgetSize }) {
  return (
    <Suspense fallback={<CalendarFallback size={size} />}>
      <CalendarBody size={size} />
    </Suspense>
  );
}

function DateBlock({ today, big = true }: { today: string; big?: boolean }) {
  return (
    <div className="shrink-0">
      <div className="text-[12px] font-semibold text-accent">{weekdayName(today)}</div>
      <div className={`font-light leading-none tracking-[-0.03em] tabular-nums ${big ? "mt-1 text-[40px]" : "mt-0.5 text-[34px]"}`}>
        {dayOfMonth(today)}
      </div>
    </div>
  );
}

function CalendarFallback({ size }: { size: WidgetSize }) {
  const { data } = useDashboard();
  return (
    <div className={`flex h-full ${size === "m" ? "flex-row gap-5" : "flex-col"}`}>
      <DateBlock today={data.today} big={size !== "s"} />
      <div className="mt-3 flex flex-1 flex-col gap-2">
        <div className="skeleton h-3.5 w-3/4 rounded-full" />
        <div className="skeleton h-3.5 w-1/2 rounded-full" />
      </div>
    </div>
  );
}

function CalendarBody({ size }: { size: WidgetSize }) {
  const { data, calendar, nowMs } = useDashboard();
  const cal: CalendarData = use(calendar);
  const [listRef, fit] = useFitCount<HTMLDivElement>(30, size === "l" ? 7 : 3);
  const { today, tz } = data;

  if (!cal.accounts.length && !cal.events.length) return <ConnectState size={size} configured={cal.configured} error={cal.error} />;

  const todays = remainingToday(cal.events, today, tz, nowMs);
  const current = todays.find((e) => isNow(e, nowMs));
  const next = todays.find((e) => !e.all_day && Date.parse(e.start) > nowMs);

  if (size === "s") {
    const focus = current ?? next ?? todays[0];
    return (
      <div className="flex h-full flex-col">
        <DateBlock today={today} big={false} />
        <div className="mt-auto min-w-0">
          {cal.error && !cal.events.length ? (
            <p className="line-clamp-2 text-[12.5px] text-ink-3">Calendar unavailable</p>
          ) : focus ? (
            <>
              <div className={`text-[11.5px] font-semibold ${focus === current ? "text-accent" : "text-gray-500"}`}>
                {focus === current ? "Now" : focus.all_day ? "Today" : `Next · ${eventTime(focus.start, tz)}`}
              </div>
              <div className="mt-0.5 line-clamp-2 text-[14px] font-medium leading-snug">{focus.title}</div>
            </>
          ) : (
            <div className="text-[13.5px] text-ink-3">No more events today</div>
          )}
        </div>
      </div>
    );
  }

  const rowsToday = (
    <EventRows events={todays} current={current} next={next} limit={size === "l" ? Math.min(fit, todays.length) : fit} />
  );

  if (size === "m") {
    return (
      <div className="flex h-full gap-5">
        <DateBlock today={today} />
        <div ref={listRef} className="min-w-0 flex-1 overflow-hidden">
          {cal.error && !cal.events.length ? (
            <InlineError message={cal.error} />
          ) : todays.length ? (
            rowsToday
          ) : (
            <p className="pt-1 text-[13.5px] text-ink-3">Nothing else today.</p>
          )}
        </div>
      </div>
    );
  }

  // Large: today, then the rest of the week.
  const later = groupByDay(
    cal.events.filter((e) => eventDate(e, tz) > today),
    tz,
  );
  // Fill the remaining rows with later days, one row per day header.
  const laterShown: [string, CalendarEvent[]][] = [];
  for (let budget = Math.max(0, fit - Math.max(1, todays.length) - 1), i = 0; budget > 1 && i < later.length; i++) {
    const shown = later[i][1].slice(0, budget - 1);
    laterShown.push([later[i][0], shown]);
    budget -= shown.length + 1;
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between">
        <DateBlock today={today} />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white" aria-hidden>
          <IconPlus size={17} strokeWidth={2.2} />
        </span>
      </div>
      <div ref={listRef} className="mt-3 min-h-0 flex-1 overflow-hidden">
        {cal.error && !cal.events.length ? (
          <InlineError message={cal.error} />
        ) : (
          <>
            {todays.length ? rowsToday : <p className="flex h-[30px] items-center text-[13.5px] text-ink-3">Nothing else today.</p>}
            {laterShown.map(([day, shown]) => (
              <div key={day} className="mt-1">
                <div className="flex h-[26px] items-end pb-1 text-[11.5px] font-semibold text-gray-500">{shortDate(day)}</div>
                <EventRows events={shown} limit={shown.length} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function EventRows({
  events,
  current,
  next,
  limit,
}: {
  events: CalendarEvent[];
  current?: CalendarEvent;
  next?: CalendarEvent;
  limit: number;
}) {
  const { data } = useDashboard();
  return (
    <ul>
      {events.slice(0, limit).map((e) => {
        const live = e === current;
        return (
          <li key={e.id} className="flex h-[30px] items-center gap-2.5">
            <span className={`w-[52px] shrink-0 text-[12px] tabular-nums ${live ? "font-semibold text-accent" : "text-gray-500"}`}>
              {e.all_day ? "All day" : eventTime(e.start, data.tz)}
            </span>
            <span className="h-[18px] w-[3px] shrink-0 rounded-full" style={{ background: e.color ?? "var(--accent)" }} />
            <span className={`min-w-0 flex-1 truncate text-[14px] ${live || e === next ? "font-semibold" : "font-medium"}`}>
              {e.title}
            </span>
            {live && <span className="h-0 w-0 shrink-0 border-y-[4px] border-r-[6px] border-y-transparent border-r-accent" aria-label="Now" />}
          </li>
        );
      })}
    </ul>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="line-clamp-3 text-[13px] leading-snug text-ink-3">
      Calendar unavailable. <span className="text-ink-3/80">{message}</span>
    </p>
  );
}

function ConnectState({ size, configured, error }: { size: WidgetSize; configured: boolean; error: string | null }) {
  const { data } = useDashboard();
  return (
    <div className={`flex h-full ${size === "m" ? "flex-row gap-5" : "flex-col"}`}>
      <DateBlock today={data.today} big={size !== "s"} />
      <div className={`flex min-w-0 flex-1 flex-col ${size === "m" ? "justify-center" : "mt-auto"}`}>
        {configured ? (
          <>
            {size !== "s" && <p className="mb-2.5 text-[13.5px] leading-snug text-ink-2">See your day at a glance.</p>}
            <a
              href="/api/google/connect"
              onClick={stop}
              onPointerDown={stop}
              className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-full bg-ink px-3.5 text-[13px] font-medium text-white transition hover:bg-gray-900"
            >
              <IconCalendar size={15} /> {size === "s" ? "Connect" : "Connect Google Calendar"}
            </a>
          </>
        ) : (
          <p className="text-[13px] leading-snug text-ink-3">
            {error ?? "Google Calendar isn't configured on this deployment."}
          </p>
        )}
      </div>
    </div>
  );
}
