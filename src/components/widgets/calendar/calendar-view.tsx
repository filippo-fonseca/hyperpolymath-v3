"use client";

import { Suspense, use, useEffect, useState } from "react";
import type { CalendarData, CalendarEvent } from "@/lib/dashboard-types";
import { addDays } from "@/lib/time";
import { safeHref } from "@/lib/markdown";
import { longDate, shortDate, weekdayName } from "@/lib/format";
import { createEventAction, deleteEventAction, listEventsAction } from "@/app/actions/calendar";
import { Button, IconButton, Segmented, fieldClass } from "@/components/ui/primitives";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconPlus, IconTrash } from "@/components/ui/icons";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { useDashboard } from "@/components/dashboard/context";
import { durationLabel, eventDate, eventTime, groupByDay, isNow } from "./calendar-utils";

type Mode = "day" | "week";

export function CalendarView() {
  return (
    <Suspense fallback={<div className="skeleton h-40 rounded-[18px]" />}>
      <CalendarViewInner />
    </Suspense>
  );
}

function CalendarViewInner() {
  const { data, calendar, run } = useDashboard();
  const cal: CalendarData = use(calendar);
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(data.today);
  const [adding, setAdding] = useState(false);
  const [fetched, setFetched] = useState<{ key: string; events: CalendarEvent[] } | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const from = anchor;
  const to = mode === "day" ? anchor : addDays(anchor, 6);
  const key = `${from}:${to}`;
  const covered = from >= cal.from && to <= cal.to;

  useEffect(() => {
    if (covered || !cal.accounts.length) return;
    let live = true;
    void run(listEventsAction(from, to)).then((events) => {
      if (live && events) setFetched({ key, events });
    });
    return () => {
      live = false;
    };
  }, [covered, from, to, key, cal, run]);

  if (!cal.accounts.length) {
    return (
      <div>
        <ExpandedHeader eyebrow={`${weekdayName(data.today)}, ${longDate(data.today)}`} title="Calendar" />
        <div className="flex flex-col items-center py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <IconCalendar size={22} />
          </div>
          {cal.configured ? (
            <>
              <p className="mt-4 max-w-[320px] text-[15px] leading-relaxed text-ink-2">
                Connect Google Calendar to see your agenda here and let Kiwi add events for you.
              </p>
              <a
                href="/api/google/connect"
                className="mt-5 inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-medium text-white transition hover:bg-gray-900"
              >
                Connect Google Calendar
              </a>
            </>
          ) : (
            <p className="mt-4 max-w-[340px] text-[14px] leading-relaxed text-ink-3">
              Google Calendar isn&apos;t configured on this deployment yet.
            </p>
          )}
        </div>
      </div>
    );
  }

  const source = covered ? cal.events : fetched?.key === key ? fetched.events : null;
  const events = (source ?? [])
    .filter((e) => !hidden.has(e.id))
    .filter((e) => {
      const d = eventDate(e, data.tz);
      return d >= from && d <= to;
    });
  const days: [string, CalendarEvent[]][] = mode === "day" ? [[from, events]] : groupByDay(events, data.tz);

  return (
    <div>
      <ExpandedHeader
        eyebrow={
          mode === "day" ? (
            <>
              <span className="text-accent">{weekdayName(anchor)}</span>, {longDate(anchor)}
            </>
          ) : (
            `${shortDate(from)} to ${shortDate(to)}`
          )
        }
        title="Calendar"
        aside={
          !adding && (
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              <IconPlus size={15} /> Event
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton label="Previous" onClick={() => setAnchor((a) => addDays(a, mode === "day" ? -1 : -7))}>
            <IconChevronLeft size={18} />
          </IconButton>
          <Button size="sm" variant="ghost" onClick={() => setAnchor(data.today)} disabled={anchor === data.today}>
            Today
          </Button>
          <IconButton label="Next" onClick={() => setAnchor((a) => addDays(a, mode === "day" ? 1 : 7))}>
            <IconChevronRight size={18} />
          </IconButton>
        </div>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
          ]}
        />
      </div>

      {adding && <EventForm defaultDate={anchor} onDone={() => setAdding(false)} />}
      {cal.error && covered && <p className="mb-4 rounded-[12px] bg-gray-100 px-3.5 py-2.5 text-[13px] text-ink-2">{cal.error}</p>}

      {source === null ? (
        <div className="skeleton h-32 rounded-[18px]" />
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-[15px] text-ink-3">{mode === "day" ? "Nothing on this day." : "A clear week."}</div>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map(([day, evs]) => (
            <section key={day}>
              {mode === "week" && (
                <h3 className="mb-1 text-[13px] font-semibold">
                  <span className={day === data.today ? "text-accent" : "text-gray-500"}>
                    {day === data.today ? "Today" : weekdayName(day)}
                  </span>
                  <span className="font-medium text-ink-3"> {shortDate(day).split(", ")[1]}</span>
                </h3>
              )}
              <ul className="divide-y divide-gray-150">
                {evs.map((e) => (
                  <EventRow key={e.id} e={e} onHide={(id) => setHidden((s) => new Set(s).add(id))} onUnhide={(id) => setHidden((s) => (s.delete(id), new Set(s)))} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ e, onHide, onUnhide }: { e: CalendarEvent; onHide: (id: string) => void; onUnhide: (id: string) => void }) {
  const { data, nowMs, run } = useDashboard();
  const [confirm, setConfirm] = useState(false);
  const live = isNow(e, nowMs);
  return (
    <li className="group flex items-center gap-3 py-2.5">
      <div className="w-[64px] shrink-0 text-[13px] tabular-nums">
        <div className={live ? "font-semibold text-accent" : "text-ink-2"}>{e.all_day ? "All day" : eventTime(e.start, data.tz)}</div>
        {!e.all_day && <div className="text-[12px] text-ink-3">{durationLabel(e)}</div>}
      </div>
      <span className="w-[3px] self-stretch rounded-full" style={{ background: e.color ?? "var(--accent)" }} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium leading-snug">
          {safeHref(e.link) ? (
            <a href={safeHref(e.link)!} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
              {e.title}
            </a>
          ) : (
            e.title
          )}
        </div>
        <div className="truncate text-[12.5px] text-gray-500">
          {[e.location, e.calendar].filter(Boolean).join(" · ")}
        </div>
      </div>
      {e.task_id ? (
        <span className="shrink-0 rounded-full bg-gray-150 px-2 py-0.5 text-[11.5px] font-medium text-ink-2">Task</span>
      ) : confirm ? (
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Keep
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              onHide(e.id);
              const ok = await run(deleteEventAction(e.id), { success: "Event removed" });
              if (!ok) onUnhide(e.id);
            }}
          >
            Delete
          </Button>
        </div>
      ) : (
        <IconButton label="Delete event" className="h-8 w-8 opacity-60 group-hover:opacity-100" onClick={() => setConfirm(true)}>
          <IconTrash size={15} />
        </IconButton>
      )}
    </li>
  );
}

const DURATIONS = [15, 30, 45, 60, 90, 120];

function EventForm({ defaultDate, onDone }: { defaultDate: string; onDone: () => void }) {
  const { run } = useDashboard();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [allDay, setAllDay] = useState(false);
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const ok = await run(
      createEventAction({
        title: title.trim(),
        date,
        start_time: allDay ? null : time,
        duration_minutes: allDay ? undefined : duration,
      }),
      { success: "Event added" },
    );
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="mb-6 flex flex-col gap-3 rounded-[18px] bg-gray-50 p-4 shadow-ring"
    >
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" maxLength={300} className={`${fieldClass} w-full`} />
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldClass} w-[150px]`} aria-label="Date" />
        {!allDay && (
          <>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${fieldClass} w-[112px]`} aria-label="Start time" />
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={`${fieldClass} w-[100px] appearance-none`}
              aria-label="Duration"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} h`}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="ml-1 flex items-center gap-2 text-[13.5px] text-ink-2">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-[#1084fe]" />
          All day
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" variant="dark" type="submit" disabled={busy || !title.trim()}>
          Add event
        </Button>
      </div>
    </form>
  );
}
