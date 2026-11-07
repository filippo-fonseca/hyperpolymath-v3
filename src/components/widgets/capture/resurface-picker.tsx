"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import type { Schedule } from "@/lib/schedule";
import {
  EVERY_DAYS_MAX,
  EVERY_DAYS_MIN,
  buildResurface,
  choiceFor,
  firstReturn,
  quickPicks,
  summarize,
  type Repeat,
  type ResurfaceChoice,
} from "@/lib/resurface-choice";
import { shortDate, timeLabel } from "@/lib/format";
import { daysBetween } from "@/lib/time";
import { Button, IconButton, Segmented, Sheet, fieldClass, useEscape, useMediaQuery } from "@/components/ui/primitives";
import { IconMinus, IconPlus } from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";

type Target = { resurface_schedule: unknown; resurface_next_at: string | null };
export type ResurfaceSave = (schedule: Schedule | null, startAt: string | null) => Promise<unknown>;

const WIDTH = 368;

const nowrap = (s: string) => <span className="whitespace-nowrap">{s}</span>;
const REPEATS: { value: Repeat; label: React.ReactNode }[] = [
  { value: "never", label: nowrap("Once") },
  { value: "daily", label: nowrap("Daily") },
  { value: "weekdays", label: nowrap("Weekdays") },
  { value: "every", label: nowrap("Every few days") },
];

/**
 * "Bring it back" picker: quick picks, a date and time, and how it repeats.
 * A popover next to its button on desktop, a bottom sheet on phones.
 */
export function ResurfacePicker({
  open,
  anchor,
  onClose,
  target,
  onSave,
}: {
  open: boolean;
  /** The button it opened from, for placing the desktop popover. */
  anchor: DOMRect | null;
  onClose: () => void;
  target: Target | null;
  onSave: ResurfaceSave;
}) {
  const desktop = useMediaQuery("(min-width: 640px)");
  if (!desktop) {
    return (
      <Sheet open={open} onClose={onClose} title="Bring it back" width={400}>
        {open && <PickerBody target={target} onSave={onSave} onClose={onClose} />}
      </Sheet>
    );
  }
  if (!open || !anchor) return null;
  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div className="px-4 pb-1 pt-3.5 text-[15px] font-semibold">Bring it back</div>
      <div className="px-4 pb-4">
        <PickerBody target={target} onSave={onSave} onClose={onClose} />
      </div>
    </Popover>
  );
}

function Popover({ anchor, onClose, children }: { anchor: DOMRect; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  useEscape(onClose);

  // Below the button when it fits, else above, else on the roomier side and scrolling.
  useLayoutEffect(() => {
    const h = ref.current?.scrollHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const roomBelow = vh - anchor.bottom - 16;
    const roomAbove = anchor.top - 16;
    const left = Math.max(8, Math.min(anchor.left - 8, vw - WIDTH - 8));
    if (h <= roomBelow || roomBelow >= roomAbove) {
      setPos({ top: anchor.bottom + 8, left, maxHeight: Math.max(160, roomBelow) });
    } else {
      const maxHeight = Math.min(h, roomAbove);
      setPos({ top: anchor.top - 8 - maxHeight, left, maxHeight });
    }
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <motion.div
      ref={ref}
      role="dialog"
      aria-label="Bring it back"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.14 }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[70] overflow-y-auto overflow-x-hidden overscroll-contain rounded-[20px] bg-surface shadow-pop"
      style={{
        width: WIDTH,
        top: pos?.top ?? anchor.bottom + 8,
        left: pos?.left ?? anchor.left,
        maxHeight: pos?.maxHeight,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </motion.div>,
    document.body,
  );
}

function PickerBody({ target, onSave, onClose }: { target: Target | null; onSave: ResurfaceSave; onClose: () => void }) {
  const { data, nowMs } = useDashboard();
  const tz = data.tz;
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const [choice, setChoice] = useState<ResurfaceChoice>(() => choiceFor(target, now, tz));
  const [busy, setBusy] = useState(false);
  const picks = useMemo(() => quickPicks(now, tz), [now, tz]);
  const scheduled = !!target?.resurface_next_at || !!target?.resurface_schedule;
  const valid = !!firstReturn(choice, now, tz);
  const set = (patch: Partial<ResurfaceChoice>) => setChoice((c) => ({ ...c, ...patch }));

  const save = async (c: ResurfaceChoice | null) => {
    setBusy(true);
    const built = c ? buildResurface(c, tz) : null;
    const ok = await onSave(built?.schedule ?? null, built?.startAt ?? null);
    setBusy(false);
    if (ok !== null) onClose();
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="-mx-1.5 flex flex-col">
        {picks.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ ...choice, date: p.date, time: p.time, repeat: "never" })}
              className="flex h-10 w-full items-center justify-between rounded-[12px] px-2.5 text-left text-[14px] transition-colors hover:bg-gray-150 focus-visible:bg-gray-150 disabled:opacity-50"
            >
              <span className="font-medium">{p.label}</span>
              <span className="text-[13px] text-ink-3">{pickHint(p.date, p.time, data.today)}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="h-px bg-gray-150" />

      <div className="flex flex-col gap-3">
        <div className="text-[12px] font-semibold text-gray-500">Pick a time</div>
        <div className="flex gap-2">
          <input
            type="date"
            aria-label="Date"
            value={choice.date}
            min={data.today}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
            className={`${fieldClass} min-w-0 flex-1`}
          />
          <input
            type="time"
            aria-label="Time"
            value={choice.time}
            onChange={(e) => e.target.value && set({ time: e.target.value })}
            className={`${fieldClass} w-[132px] shrink-0`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-gray-500">Repeat</span>
          <Segmented size="sm" value={choice.repeat} options={REPEATS} onChange={(repeat) => set({ repeat })} className="self-start" />
          {choice.repeat === "every" && (
            <div className="flex items-center gap-2 text-[14px] text-ink-2">
              Every
              <IconButton
                label="Fewer days"
                className="h-8 w-8 bg-gray-150"
                disabled={choice.everyDays <= EVERY_DAYS_MIN}
                onClick={() => set({ everyDays: Math.max(EVERY_DAYS_MIN, choice.everyDays - 1) })}
              >
                <IconMinus size={15} />
              </IconButton>
              <span className="w-5 text-center font-semibold tabular-nums text-ink" aria-live="polite">
                {choice.everyDays}
              </span>
              <IconButton
                label="More days"
                className="h-8 w-8 bg-gray-150"
                disabled={choice.everyDays >= EVERY_DAYS_MAX}
                onClick={() => set({ everyDays: Math.min(EVERY_DAYS_MAX, choice.everyDays + 1) })}
              >
                <IconPlus size={15} />
              </IconButton>
              days
            </div>
          )}
        </div>
        <p className={`text-[13.5px] leading-snug ${valid ? "text-ink-2" : "text-[#c4182b]"}`} aria-live="polite">
          {summarize(choice, now, tz)}
        </p>
        <div className="flex items-center justify-end gap-2">
          {scheduled && (
            <Button size="sm" variant="ghost" className="mr-auto text-ink-2" disabled={busy} onClick={() => save(null)}>
              Stop bringing it back
            </Button>
          )}
          <Button size="sm" variant="dark" disabled={!valid || busy} onClick={() => save(choice)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/** "6pm", "Thu 9am", "Dec 11 9am" for the quick pick rows. */
function pickHint(date: string, time: string, today: string) {
  const t = timeLabel(time);
  const n = daysBetween(today, date);
  if (n === 0) return t;
  if (n < 7) return `${shortDate(date).split(",")[0]} ${t}`;
  return `${shortDate(date).split(", ")[1]} ${t}`;
}
