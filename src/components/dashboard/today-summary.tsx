"use client";

import { Suspense, use, type ReactNode } from "react";
import type { WidgetRow } from "@/lib/dashboard-types";
import { pluralize } from "@/lib/format";
import { useDashboard } from "./context";
import { KindIcon } from "./features";
import { eventTime, isNow, remainingToday } from "@/components/widgets/calendar/calendar-utils";

/**
 * One row of chips under the greeting: what's due, what's next on the
 * calendar, how habits are going, what's waiting in the inbox. Each opens its
 * feature.
 */
export function TodaySummary({ widgets, onOpen }: { widgets: WidgetRow[]; onOpen: (w: WidgetRow) => void }) {
  const { data } = useDashboard();
  const find = (kind: string) => widgets.find((w) => w.kind === kind);
  const tasks = find("tasks");
  const calendar = find("calendar");
  const habits = find("habits");
  const capture = find("capture");

  const due = data.openTasks.filter((t) => t.due_date && t.due_date <= data.today);
  const overdue = due.filter((t) => t.due_date! < data.today).length;
  const scheduled = data.habits.filter((h) => h.scheduled_today);
  const habitsDone = scheduled.filter((h) => h.today_progress >= 3).length;
  const toSort = data.resurfacing.length || data.captures.length;

  return (
    <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {tasks && (
        <Chip widget={tasks} onClick={() => onOpen(tasks)}>
          {due.length ? `${pluralize(due.length, "task")} due` : "Nothing due today"}
          {overdue > 0 && <span className="text-danger">{overdue} overdue</span>}
        </Chip>
      )}
      {calendar && (
        <Suspense fallback={null}>
          <NextEventChip widget={calendar} onOpen={onOpen} />
        </Suspense>
      )}
      {habits && scheduled.length > 0 && (
        <Chip widget={habits} onClick={() => onOpen(habits)}>
          {habitsDone === scheduled.length ? "All habits done" : `${habitsDone} of ${scheduled.length} habits`}
        </Chip>
      )}
      {capture && toSort > 0 && (
        <Chip widget={capture} onClick={() => onOpen(capture)}>
          {data.resurfacing.length ? `${pluralize(data.resurfacing.length, "capture")} back today` : `${toSort} in your inbox`}
        </Chip>
      )}
    </div>
  );
}

function NextEventChip({ widget, onOpen }: { widget: WidgetRow; onOpen: (w: WidgetRow) => void }) {
  const { data, calendar, nowMs } = useDashboard();
  const cal = use(calendar);
  if (!cal.accounts.length) return null;
  const todays = remainingToday(cal.events, data.today, data.tz, nowMs);
  const current = todays.find((e) => isNow(e, nowMs));
  const next = todays.find((e) => !e.all_day && Date.parse(e.start) > nowMs);
  const focus = current ?? next;
  return (
    <Chip widget={widget} onClick={() => onOpen(widget)}>
      {focus ? (
        <>
          <span className={focus === current ? "text-accent" : "text-ink-3"}>{focus === current ? "Now" : eventTime(focus.start, data.tz)}</span>
          <span className="max-w-[180px] truncate">{focus.title}</span>
        </>
      ) : (
        "No more events today"
      )}
    </Chip>
  );
}

function Chip({ widget, onClick, children }: { widget: WidgetRow; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface pl-2.5 pr-3 text-[13px] font-medium text-ink-2 shadow-ring transition hover:text-ink hover:shadow-[0_0_0_1px_rgb(20_20_20/0.1),0_2px_6px_rgb(20_20_20/0.06)]"
    >
      <KindIcon widget={widget} size={14} />
      {children}
    </button>
  );
}
