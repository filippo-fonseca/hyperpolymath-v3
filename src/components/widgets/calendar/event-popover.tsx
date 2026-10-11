"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import type { CalendarEvent } from "@/lib/dashboard-types";
import { safeHref } from "@/lib/markdown";
import { shortDate } from "@/lib/format";
import { deleteEventAction } from "@/app/actions/calendar";
import { Button, useMediaQuery } from "@/components/ui/primitives";
import { IconCalendar, IconClock, IconGlobe, IconLink, IconTrash } from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";
import { durationLabel, eventSpan, eventTime } from "./calendar-utils";

export type Selected = { e: CalendarEvent; rect: DOMRect };

const WIDTH = 300;
const GAP = 8;

/** Small detail card next to the tapped event (a bottom card on phones). */
export function EventPopover({
  selected,
  onClose,
  onHide,
  onUnhide,
}: {
  selected: Selected;
  onClose: () => void;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
}) {
  const { data, run } = useDashboard();
  const desktop = useMediaQuery("(min-width: 640px)", true);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const { e, rect } = selected;

  // Escape closes the popover only, not the expanded calendar behind it.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useLayoutEffect(() => {
    if (!desktop) return;
    const h = ref.current?.offsetHeight ?? 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const right = rect.right + GAP;
    const left = right + WIDTH <= vw - 12 ? right : Math.max(12, rect.left - GAP - WIDTH);
    const top = Math.min(Math.max(12, rect.top), vh - h - 12);
    setPos({ left, top });
  }, [desktop, rect]);

  const color = e.color ?? "var(--accent)";
  const href = safeHref(e.link);
  const when = whenLabel(e, data.tz);

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <button type="button" aria-label="Close details" className="absolute inset-0 cursor-default" onClick={onClose} />
      <motion.div
        ref={ref}
        role="dialog"
        aria-label={e.title}
        initial={{ opacity: 0, scale: 0.97, y: desktop ? 0 : 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.28, bounce: 0 }}
        className={`absolute rounded-[18px] bg-surface p-4 shadow-pop ${
          desktop ? "" : "inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))]"
        }`}
        style={desktop ? { width: WIDTH, left: pos?.left ?? rect.right + GAP, top: pos?.top ?? rect.top, visibility: pos ? "visible" : "hidden" } : undefined}
      >
        <div className="flex items-start gap-2.5">
          {e.task_id ? (
            <span className="mt-[3px] h-[14px] w-[14px] shrink-0 rounded-[4px] border-[1.75px] border-gray-500" aria-hidden />
          ) : (
            <span className="mt-[3px] h-[14px] w-[4px] shrink-0 rounded-full" style={{ background: color }} aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">{e.title}</div>
            {e.task_id && <span className="mt-1 inline-block rounded-full bg-gray-150 px-2 py-0.5 text-[11.5px] font-medium text-ink-2">Task</span>}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-2">
          <Row icon={<IconClock size={15} />}>{when}</Row>
          <Row icon={<IconCalendar size={15} />}>{e.calendar}</Row>
          {e.location && <Row icon={<IconGlobe size={15} />}>{e.location}</Row>}
          {href && (
            <Row icon={<IconLink size={15} />}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                Open in Google Calendar
              </a>
            </Row>
          )}
        </div>

        {!e.task_id && (
          <div className="mt-4 flex justify-end gap-2">
            {confirm ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    onHide(e.id);
                    onClose();
                    const ok = await run(deleteEventAction(e.id), { success: "Event removed" });
                    if (!ok) onUnhide(e.id);
                  }}
                >
                  Delete event
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
                <IconTrash size={14} /> Delete
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-px shrink-0 text-gray-500">{icon}</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

function whenLabel(e: CalendarEvent, tz: string): string {
  const { first, last } = eventSpan(e, tz);
  if (e.all_day) return first === last ? `${shortDate(first)} · All day` : `${shortDate(first)} to ${shortDate(last)} · All day`;
  const range = `${eventTime(e.start, tz)} to ${eventTime(e.end, tz)}`;
  if (first === last) return `${shortDate(first)} · ${range} (${durationLabel(e)})`;
  return `${shortDate(first)} ${eventTime(e.start, tz)} to ${shortDate(last)} ${eventTime(e.end, tz)}`;
}
