// Routine schedules are free text from bots: usually words already ("every
// night at 10pm"), sometimes a cron expression. Turn the common cron shapes
// into words and pass anything else through.

import { timeLabel, WEEKDAYS_LONG } from "./format";

const isInt = (s: string) => /^\d+$/.test(s);
const step = (s: string) => /^\*\/(\d+)$/.exec(s)?.[1];

function expand(field: string, max: number): number[] | null {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      if (a > b || b > max) return null;
      for (let i = a; i <= b; i++) out.add(i);
    } else if (isInt(part) && Number(part) <= max) out.add(Number(part));
    else return null;
  }
  return [...out].sort((x, y) => x - y);
}

function list(items: string[]) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function daysLabel(dow: string): string | null {
  const days = expand(dow, 7)?.map((d) => d % 7);
  if (!days) return null;
  const set = [...new Set(days)].sort();
  if (set.length === 7) return "Daily";
  if (set.join() === "1,2,3,4,5") return "Weekdays";
  if (set.join() === "0,6") return "Weekends";
  return list(set.map((d) => `${WEEKDAYS_LONG[d]}s`));
}

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function scheduleInWords(raw: string | null | undefined): string {
  const s = raw?.trim();
  if (!s) return "No schedule";
  const parts = s.split(/\s+/);
  if (parts.length !== 5 || !parts.every((p) => /^[\d*/,-]+$/.test(p))) return capitalize(s);
  const [min, hour, dom, mon, dow] = parts;
  const anyDay = dom === "*" && mon === "*" && dow === "*";

  if (min === "*" && hour === "*" && anyDay) return "Every minute";
  const minStep = step(min);
  if (minStep && hour === "*" && anyDay) return `Every ${minStep} minutes`;
  if (!isInt(min) || Number(min) > 59) return s;
  const mm = min.padStart(2, "0");
  if (hour === "*" && anyDay) return `Hourly at :${mm}`;
  const hourStep = step(hour);
  if (hourStep && anyDay) return `Every ${hourStep} hours${min === "0" ? "" : ` at :${mm}`}`;

  const hours = expand(hour, 23);
  if (!hours || mon !== "*") return s;
  const times = list(hours.map((h) => timeLabel(`${String(h).padStart(2, "0")}:${mm}`) ?? ""));
  if (dom === "*" && dow === "*") return `Daily at ${times}`;
  if (dom === "*") {
    const days = daysLabel(dow);
    return days ? `${days} at ${times}` : s;
  }
  if (dow === "*" && isInt(dom) && Number(dom) >= 1 && Number(dom) <= 31) return `Monthly on the ${ordinal(Number(dom))} at ${times}`;
  return s;
}
