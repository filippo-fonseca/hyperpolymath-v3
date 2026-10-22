"use client";

import { useState, type ReactNode } from "react";
import { shortDate } from "@/lib/format";
import { PRIORITY_LEVELS, quickDates, weekdayShort } from "@/lib/today";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Button, fieldClass } from "@/components/ui/primitives";
import { IconCalendar, IconClose, IconFlag } from "@/components/ui/icons";
import { priorityColors } from "./task-bits";

/** What a schedule pick means in words, for toasts ("Moved it to tomorrow"). */
export function dateWords(date: string | null, today: string): string {
  if (!date) return "no date";
  const q = quickDates(today);
  if (date === q.today) return "today";
  if (date === q.tomorrow) return "tomorrow";
  return shortDate(date);
}

/**
 * Todoist's schedule menu: Today, Tomorrow, This weekend, Next week, No date,
 * and a date (plus time, when asked for) field underneath.
 */
export function ScheduleMenu({
  today,
  value,
  time,
  onPick,
  label = "Schedule",
  className = "",
  align = "end",
  children,
}: {
  today: string;
  value: string | null;
  /** Current "HH:MM"; pass with a time-aware onPick to show a time field. */
  time?: string | null;
  onPick: (date: string | null, time?: string | null) => void;
  label?: string;
  className?: string;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const q = quickDates(today);
  const pick = (d: string | null) => () => onPick(d);
  const items: MenuItem[] = [
    { label: "Today", icon: <IconCalendar size={15} className="text-[#1f8a52]" />, hint: weekdayShort(q.today), checked: value === q.today, onSelect: pick(q.today) },
    { label: "Tomorrow", icon: <IconCalendar size={15} className="text-[#d9730d]" />, hint: weekdayShort(q.tomorrow), checked: value === q.tomorrow, onSelect: pick(q.tomorrow) },
    ...(q.weekend !== q.today && q.weekend !== q.tomorrow
      ? [{ label: "This weekend", icon: <IconCalendar size={15} className="text-accent" />, hint: weekdayShort(q.weekend), checked: value === q.weekend, onSelect: pick(q.weekend) }]
      : []),
    { label: "Next week", icon: <IconCalendar size={15} className="text-[#7a5af8]" />, hint: shortDate(q.nextWeek).replace(",", ""), checked: value === q.nextWeek, onSelect: pick(q.nextWeek) },
    ...(value ? [{ label: "No date", icon: <IconClose size={15} />, onSelect: pick(null) }] : []),
  ];
  return (
    <Menu
      label={label}
      items={items}
      align={align}
      className={className}
      footer={(close) => <DateFields key={`${value}-${time}`} value={value} time={time} withTime={time !== undefined} onSet={(d, t) => (close(), onPick(d, t))} />}
    >
      {children}
    </Menu>
  );
}

function DateFields({
  value,
  time,
  withTime,
  onSet,
}: {
  value: string | null;
  time?: string | null;
  withTime: boolean;
  onSet: (date: string, time?: string | null) => void;
}) {
  const [date, setDate] = useState(value ?? "");
  const [at, setAt] = useState(time?.slice(0, 5) ?? "");
  const set = () => date && onSet(date, withTime ? at || null : undefined);
  return (
    <form
      className="mx-1 mt-1 flex flex-col gap-1.5 border-t border-gray-150 px-1 pb-1 pt-2"
      onSubmit={(e) => {
        // The panel is portaled, but React still bubbles to forms around the trigger.
        e.preventDefault();
        e.stopPropagation();
        set();
      }}
    >
      <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldClass} w-full`} />
      <div className="flex gap-1.5">
        {withTime && (
          <input type="time" aria-label="Time" value={at} onChange={(e) => setAt(e.target.value)} className={`${fieldClass} min-w-0 flex-1`} />
        )}
        <Button type="submit" size="sm" variant="dark" disabled={!date} className={`h-10 ${withTime ? "" : "flex-1"}`}>
          Set date
        </Button>
      </div>
    </form>
  );
}

/** P1 to P4 as menu items, with flags in each priority's color. */
export function priorityItems(value: number, onPick: (p: number) => void): MenuItem[] {
  return PRIORITY_LEVELS.map((l) => ({
    label: l.name,
    icon: <IconFlag size={15} style={{ color: priorityColors(l.value).ring }} fill={l.value ? priorityColors(l.value).ring : "none"} />,
    checked: value === l.value,
    onSelect: () => onPick(l.value),
  }));
}
