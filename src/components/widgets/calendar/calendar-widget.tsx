"use client";

import { Suspense, use } from "react";
import type { CalendarData, CalendarEvent } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { addDays, weekdayOf } from "@/lib/time";
import { WEEKDAYS_SHORT, dayOfMonth, pluralize, shortDate, weekdayName } from "@/lib/format";
import { IconCalendar, IconPlus } from "@/components/ui/icons";
import { stop, useFitCount } from "@/components/ui/primitives";
import { KiwiStargazing } from "@/components/illustrations";
import { useDashboard } from "@/components/dashboard/context";
import { HeaderAction, WidgetHeader, useWidgetFrame } from "@/components/dashboard/widget-chrome";
import { durationLabel, eventDate, eventTime, groupByDay, isNow, remainingToday } from "./calendar-utils";

// Agenda widget (Outlook-style): accent weekday, big date numeral, rows of
// time | color bar | title. Wide shows the next seven days as columns.
// Isolated so its data source can change freely.

const ROW_H = 30;

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
    <div className="flex h-full flex-col">
      <WidgetHeader />
      <div className={`mt-1 flex flex-1 ${size === "m" || size === "w" ? "flex-row gap-5" : "flex-col"}`}>
        <DateBlock today={data.today} big={size !== "s"} />
        <div className="mt-3 flex flex-1 flex-col gap-2">
          <div className="skeleton h-3.5 w-3/4 rounded-full" />
          <div className="skeleton h-3.5 w-1/2 rounded-full" />
          {size !== "s" && <div className="skeleton h-3.5 w-2/3 rounded-full" />}
        </div>
      </div>
    </div>
  );
}

/** "in 25 min", "in 2 h" until an event starts. */
function untilLabel(startMs: number, nowMs: number) {
  const m = Math.max(1, Math.round((startMs - nowMs) / 60000));
  if (m < 60) return `in ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `in ${h} h` : null;
}

function CalendarBody({ size }: { size: WidgetSize }) {
  const { data, calendar, nowMs } = useDashboard();
  const frame = useWidgetFrame();
  const cal: CalendarData = use(calendar);
  const [listRef, fit] = useFitCount<HTMLDivElement>(ROW_H, size === "l" ? 7 : 3);
  const { today, tz } = data;

  if (!cal.accounts.length && !cal.events.length) return <ConnectState size={size} configured={cal.configured} error={cal.error} />;

  const todays = remainingToday(cal.events, today, tz, nowMs);
  const current = todays.find((e) => isNow(e, nowMs));
  const next = todays.find((e) => !e.all_day && Date.parse(e.start) > nowMs);
  const unavailable = cal.error && !cal.events.length;
  const meta = unavailable ? "Unavailable" : todays.length ? `${pluralize(todays.length, "event")} left` : "Free";
  const addAction = frame && (
    <HeaderAction label="New event" onClick={frame.open}>
      <IconPlus size={16} strokeWidth={2} />
    </HeaderAction>
  );

  if (size === "s") {
    const focus = current ?? next ?? todays[0];
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader />
        <DateBlock today={today} big={false} />
        <div className="mt-auto min-w-0">
          {unavailable ? (
            <p className="line-clamp-2 text-[12.5px] text-ink-3">Calendar unavailable</p>
          ) : focus ? (
            <>
              <div className={`text-[11.5px] font-semibold ${focus === current ? "text-accent" : "text-gray-500"}`}>
                {focus === current ? "Now" : focus.all_day ? "Today" : `${eventTime(focus.start, tz)} · ${untilLabel(Date.parse(focus.start), nowMs) ?? ""}`}
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

  if (size === "w") return <WeekColumns events={cal.events} unavailable={!!unavailable} error={cal.error} meta={meta} add={addAction} />;

  const rowsToday = <EventRows events={todays} current={current} next={next} limit={size === "l" ? Math.min(fit, todays.length) : fit} />;

  if (size === "m") {
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader meta={meta} actions={addAction} />
        <div className="mt-1 flex min-h-0 flex-1 gap-5">
          <div className="flex flex-col justify-between">
            <DateBlock today={today} />
            {next && !current && (
              <div className="text-[11.5px] font-medium text-gray-500">Next {untilLabel(Date.parse(next.start), nowMs)}</div>
            )}
          </div>
          <div ref={listRef} className="min-w-0 flex-1 overflow-hidden">
            {unavailable ? (
              <InlineError message={cal.error!} />
            ) : todays.length ? (
              rowsToday
            ) : (
              <p className="pt-1 text-[13.5px] text-ink-3">Nothing else today.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Large: a "now or next" card, today, then the rest of the week.
  const later = groupByDay(
    cal.events.filter((e) => eventDate(e, tz) > today),
    tz,
  );
  const spotlight = current ?? next;
  const rest = todays.filter((e) => e !== spotlight);
  // Fill the remaining rows with later days, one row per day header.
  const laterShown: [string, CalendarEvent[]][] = [];
  for (let budget = Math.max(0, fit - Math.max(1, rest.length) - 1), i = 0; budget > 1 && i < later.length; i++) {
    const shown = later[i][1].slice(0, budget - 1);
    laterShown.push([later[i][0], shown]);
    budget -= shown.length + 1;
  }
  return (
    <div className="flex h-full flex-col">
      <WidgetHeader meta={meta} actions={addAction} />
      <div className="mt-1 flex items-end gap-4">
        <DateBlock today={today} />
        {spotlight && <Spotlight event={spotlight} live={spotlight === current} />}
      </div>
      <div ref={listRef} className="mt-3 min-h-0 flex-1 overflow-hidden">
        {unavailable ? (
          <InlineError message={cal.error!} />
        ) : (
          <>
            {rest.length ? (
              <EventRows events={rest} current={current} next={next} limit={Math.min(fit, rest.length)} />
            ) : (
              <p className="flex h-[30px] items-center text-[13.5px] text-ink-3">{spotlight ? "Nothing after that today." : "Nothing else today."}</p>
            )}
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

/** The ongoing or next event, tinted with its calendar color. */
function Spotlight({ event, live }: { event: CalendarEvent; live: boolean }) {
  const { data, nowMs } = useDashboard();
  const color = event.color ?? "var(--accent)";
  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden rounded-[14px] py-2 pl-3.5 pr-3"
      style={{ background: `color-mix(in srgb, ${color} 10%, white)` }}
    >
      <span className="absolute inset-y-2 left-1.5 w-[3px] rounded-full" style={{ background: color }} />
      <div className="text-[11.5px] font-semibold" style={{ color: live ? "var(--accent)" : "var(--gray-600)" }}>
        {live ? `Now · until ${eventTime(event.end, data.tz)}` : `${eventTime(event.start, data.tz)} · ${untilLabel(Date.parse(event.start), nowMs) ?? durationLabel(event)}`}
      </div>
      <div className="truncate text-[14.5px] font-semibold leading-snug">{event.title}</div>
      {event.location && <div className="truncate text-[12px] text-ink-3">{event.location}</div>}
    </div>
  );
}

/** Seven columns, today first: day header and that day's events. */
function WeekColumns({
  events,
  unavailable,
  error,
  meta,
  add,
}: {
  events: CalendarEvent[];
  unavailable: boolean;
  error: string | null;
  meta: string;
  add: React.ReactNode;
}) {
  const { data, nowMs } = useDashboard();
  const [ref, fit] = useFitCount<HTMLDivElement>(44, 4);
  const days = Array.from({ length: 7 }, (_, i) => addDays(data.today, i));
  const byDay = new Map(groupByDay(events, data.tz));
  return (
    <div className="flex h-full flex-col">
      <WidgetHeader meta={meta} actions={add} />
      {unavailable ? (
        <div className="mt-2">
          <InlineError message={error ?? ""} />
        </div>
      ) : (
        <div className="mt-2 grid min-h-0 flex-1 grid-cols-7 gap-2">
          {days.map((day, i) => {
            const list = (byDay.get(day) ?? []).filter((e) => i > 0 || e.all_day || Date.parse(e.end) > nowMs);
            const room = Math.max(1, fit);
            const shown = list.length > room ? list.slice(0, room - 1) : list;
            return (
              <section key={day} className={`flex min-h-0 min-w-0 flex-col rounded-[14px] p-1.5 ${i === 0 ? "bg-accent-soft" : "bg-gray-50"}`}>
                <h3 className="flex h-9 shrink-0 items-baseline gap-1 px-1 pt-0.5">
                  <span className={`text-[11.5px] font-semibold ${i === 0 ? "text-accent" : "text-gray-500"}`}>
                    {i === 0 ? "Today" : WEEKDAYS_SHORT[weekdayOf(day)]}
                  </span>
                  <span className={`text-[17px] font-light tabular-nums ${i === 0 ? "text-accent" : "text-ink-2"}`}>{dayOfMonth(day)}</span>
                </h3>
                <div ref={i === 0 ? ref : undefined} className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                  {shown.map((e) => (
                    <EventChip key={e.id} event={e} live={isNow(e, nowMs)} />
                  ))}
                  {list.length > shown.length && (
                    <div className="px-1 text-[11.5px] text-gray-500">{list.length - shown.length} more</div>
                  )}
                  {list.length === 0 && <div className="px-1 text-[11.5px] text-ink-3">Free</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventChip({ event, live }: { event: CalendarEvent; live: boolean }) {
  const { data } = useDashboard();
  const color = event.color ?? "var(--accent)";
  return (
    <div
      className="relative min-w-0 shrink-0 overflow-hidden rounded-[9px] py-1 pl-2.5 pr-1.5"
      style={{ background: `color-mix(in srgb, ${color} 12%, white)` }}
      title={event.title}
    >
      <span className="absolute inset-y-1 left-1 w-[2.5px] rounded-full" style={{ background: color }} />
      <div className={`truncate text-[10.5px] tabular-nums ${live ? "font-semibold text-accent" : "text-gray-600"}`}>
        {event.all_day ? "All day" : eventTime(event.start, data.tz)}
      </div>
      <div className="truncate text-[12.5px] font-medium leading-tight">{event.title}</div>
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
            {!e.all_day && !live && <span className="shrink-0 text-[11.5px] tabular-nums text-ink-3 max-sm:hidden">{durationLabel(e)}</span>}
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
  const roomy = size === "l" || size === "w";
  return (
    <div className="flex h-full flex-col">
      <WidgetHeader />
      <div className={`mt-1 flex min-h-0 flex-1 ${size === "m" || size === "w" ? "flex-row gap-5" : "flex-col"}`}>
        <DateBlock today={data.today} big={size !== "s"} />
        {size === "l" && (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <KiwiStargazing size={136} />
          </div>
        )}
        <div className={`flex min-w-0 flex-1 flex-col ${size === "m" || size === "w" ? "justify-center" : size === "l" ? "flex-none" : "mt-auto"}`}>
          {configured ? (
            <>
              {size !== "s" && (
                <p className="mb-2.5 text-[13.5px] leading-snug text-ink-2">
                  {roomy ? "Connect Google Calendar to see your day and week here, and add events from the app." : "See your day at a glance."}
                </p>
              )}
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
            <p className="text-[13px] leading-snug text-ink-3">{error ?? "Google Calendar isn't configured on this deployment."}</p>
          )}
        </div>
        {(size === "m" || size === "w") && <KiwiStargazing size={size === "w" ? 140 : 104} className="shrink-0 self-center max-sm:hidden" />}
      </div>
    </div>
  );
}
