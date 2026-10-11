"use client";

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarData, CalendarEvent } from "@/lib/dashboard-types";
import { addDays } from "@/lib/time";
import { safeHref } from "@/lib/markdown";
import { longDate, shortDate, weekdayName } from "@/lib/format";
import { createEventAction, deleteEventAction, listEventsAction } from "@/app/actions/calendar";
import { Button, IconButton, Segmented, fieldClass } from "@/components/ui/primitives";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconPlus, IconTrash } from "@/components/ui/icons";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { useDashboard } from "@/components/dashboard/context";
import {
  addMonths,
  durationLabel,
  eventTime,
  groupByDay,
  isNow,
  monthGridStart,
  monthLabel,
  overlapsRange,
  timedTaskEvents,
  weekStart,
} from "./calendar-utils";
import { WeekGrid } from "./week-grid";

type View = "agenda" | "week" | "month";
type Draft = { date: string; time?: string };
/** Fetched Google events per "from:to" range; null marks a failed fetch. Tied to one calendar payload. */
type RangeCache = { cal: CalendarData; ranges: Record<string, CalendarEvent[] | null> };

const VIEWS: { value: View; label: string }[] = [
  { value: "agenda", label: "Agenda" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function rangeFor(view: View, anchor: string): { from: string; to: string } {
  if (view === "agenda") return { from: anchor, to: addDays(anchor, 6) };
  if (view === "week") {
    const from = weekStart(anchor);
    return { from, to: addDays(from, 6) };
  }
  const from = monthGridStart(anchor);
  return { from, to: addDays(from, 41) };
}

function step(view: View, anchor: string, dir: 1 | -1) {
  return view === "month" ? addMonths(anchor, dir) : addDays(anchor, 7 * dir);
}

export function CalendarView() {
  return (
    <Suspense fallback={<div className="skeleton h-40 rounded-[18px]" />}>
      <CalendarViewInner />
    </Suspense>
  );
}

function CalendarViewInner() {
  const { data, calendar, run, nowMs } = useDashboard();
  const cal: CalendarData = use(calendar);
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(data.today);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cache, setCache] = useState<RangeCache>(() => ({ cal, ranges: {} }));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const inflight = useRef(new WeakMap<CalendarData, Set<string>>());

  // A refreshed payload (after any write) invalidates every fetched range.
  const ranges = useMemo(() => (cache.cal === cal ? cache.ranges : {}), [cache, cal]);
  const { from, to } = rangeFor(view, anchor);
  const key = `${from}:${to}`;
  const covered =
    (from >= cal.from && to <= cal.to) ||
    Object.keys(ranges).some((k) => {
      const [a, b] = k.split(":");
      return a <= from && b >= to;
    });
  const loading = !covered && cal.accounts.length > 0;

  useEffect(() => {
    if (covered || !cal.accounts.length) return;
    let pending = inflight.current.get(cal);
    if (!pending) inflight.current.set(cal, (pending = new Set()));
    if (pending.has(key)) return;
    pending.add(key);
    void run(listEventsAction(from, to)).then((events) => {
      pending.delete(key);
      setCache((c) => (c.cal === cal ? { cal, ranges: { ...c.ranges, [key]: events } } : { cal, ranges: { [key]: events } }));
    });
  }, [covered, from, to, key, cal, run]);

  // Keyboard: left / right step through ranges, T jumps to today.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "ArrowLeft") setAnchor((a) => step(view, a, -1));
      else if (e.key === "ArrowRight") setAnchor((a) => step(view, a, 1));
      else if (e.key === "t" || e.key === "T") setAnchor(data.today);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, data.today]);

  // Everything known so far, newest fetch winning. Shown while another range loads.
  const known = useMemo(() => {
    const byId = new Map<string, CalendarEvent>();
    for (const e of cal.events) if (!e.task_id) byId.set(e.id, e);
    for (const list of Object.values(ranges)) for (const e of list ?? []) if (!e.task_id) byId.set(e.id, e);
    return [...byId.values()];
  }, [cal, ranges]);

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

  const events = [...known.filter((e) => overlapsRange(e, from, to, data.tz)), ...timedTaskEvents(data.openTasks, from, to, data.tz)]
    .filter((e) => !hidden.has(e.id))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const hide = (id: string) => setHidden((s) => new Set(s).add(id));
  const unhide = (id: string) => setHidden((s) => (s.delete(id), new Set(s)));
  const empty = loading && events.length === 0;

  return (
    <div>
      <ExpandedHeader
        eyebrow={view === "month" ? monthLabel(anchor) : `${shortDate(from)} to ${shortDate(to)}`}
        title="Calendar"
        aside={
          !draft && (
            <Button size="sm" variant="primary" onClick={() => setDraft({ date: anchor })}>
              <IconPlus size={15} /> Event
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton label="Previous" onClick={() => setAnchor((a) => step(view, a, -1))}>
            <IconChevronLeft size={18} />
          </IconButton>
          <Button size="sm" variant="ghost" onClick={() => setAnchor(data.today)} disabled={anchor === data.today}>
            Today
          </Button>
          <IconButton label="Next" onClick={() => setAnchor((a) => step(view, a, 1))}>
            <IconChevronRight size={18} />
          </IconButton>
          <span
            aria-hidden
            className={`ml-1 h-1.5 w-1.5 rounded-full bg-accent transition-opacity duration-300 ${loading ? "animate-pulse opacity-100" : "opacity-0"}`}
          />
        </div>
        <Segmented<View> value={view} onChange={setView} options={VIEWS} />
      </div>

      {draft && <EventForm key={`${draft.date}-${draft.time ?? ""}`} draft={draft} onDone={() => setDraft(null)} />}
      {cal.error && from >= cal.from && from <= cal.to && (
        <p className="mb-4 rounded-[12px] bg-gray-100 px-3.5 py-2.5 text-[13px] text-ink-2">{cal.error}</p>
      )}

      {empty ? (
        <div className="skeleton h-32 rounded-[18px]" />
      ) : view === "week" ? (
        <WeekGrid from={from} events={events} tz={data.tz} today={data.today} nowMs={nowMs} />
      ) : (
        <AgendaList events={events} tz={data.tz} today={data.today} onHide={hide} onUnhide={unhide} />
      )}
    </div>
  );
}

const sortKey = (e: CalendarEvent) => (e.all_day ? `${e.start.slice(0, 10)}T00:00:00.000Z#0` : `${e.start}#1`);

function AgendaList({
  events,
  tz,
  today,
  onHide,
  onUnhide,
}: {
  events: CalendarEvent[];
  tz: string;
  today: string;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
}) {
  if (events.length === 0) return <div className="py-12 text-center text-[15px] text-ink-3">A clear week.</div>;
  return (
    <div className="flex flex-col gap-6">
      {groupByDay(events, tz).map(([day, evs]) => (
        <section key={day}>
          <h3 className="mb-1 text-[13px] font-semibold">
            <span className={day === today ? "text-accent" : "text-gray-500"}>{day === today ? "Today" : weekdayName(day)}</span>
            <span className="font-medium text-ink-3"> {shortDate(day).split(", ")[1]}</span>
          </h3>
          <ul className="divide-y divide-gray-150">
            {evs.map((e) => (
              <EventRow key={e.id} e={e} onHide={onHide} onUnhide={onUnhide} />
            ))}
          </ul>
        </section>
      ))}
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

function EventForm({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const { run } = useDashboard();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(draft.date);
  const [time, setTime] = useState(draft.time ?? "09:00");
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
