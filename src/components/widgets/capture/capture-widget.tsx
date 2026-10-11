"use client";

import type { WidgetSize } from "@/lib/widgets";
import { relativeTime } from "@/lib/format";
import { createCaptureAction } from "@/app/actions/captures";
import { Eyebrow, useFitCount } from "@/components/ui/primitives";
import { IconPencil } from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";
import { QuickAdd } from "../tasks/task-bits";

const ROW_H = 28;

/** Craft-style "What's on your mind?" input with a quiet recent list. */
export function CaptureWidget({ size }: { size: WidgetSize }) {
  const { data, nowMs, run } = useDashboard();
  const [listRef, fit] = useFitCount<HTMLDivElement>(ROW_H, size === "l" ? 5 : 2);

  if (size === "s") {
    return (
      <div className="flex h-full flex-col">
        <Eyebrow>Capture</Eyebrow>
        <div className="mt-auto flex items-center gap-2.5 rounded-[14px] bg-gray-100 px-3 py-3 text-[14px] text-ink-3">
          <IconPencil size={16} className="shrink-0 text-gray-500" />
          <span className="leading-tight">What&apos;s on your mind?</span>
        </div>
      </div>
    );
  }

  const resurfacing = size === "l" ? data.resurfacing.slice(0, 2) : [];
  const recent = data.captures.filter((c) => !resurfacing.some((r) => r.id === c.id)).slice(0, Math.max(0, fit - resurfacing.length));

  return (
    <div className="flex h-full flex-col">
      {size === "l" && <Eyebrow className="mb-2.5">Capture</Eyebrow>}
      <QuickAdd
        placeholder="What's on your mind?"
        onSubmit={(content) => run(createCaptureAction(content), { success: "Captured" })}
      />
      <div ref={listRef} className="mt-2 min-h-0 flex-1 overflow-hidden">
        <ul>
          {resurfacing.map((c) => (
            <li key={c.id} className="flex h-7 items-center gap-2 text-[14px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Resurfacing" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.content}</span>
              <span className="shrink-0 text-[12.5px] text-accent">today</span>
            </li>
          ))}
          {recent.map((c) => (
            <li key={c.id} className="flex h-7 items-center gap-2 text-[14px]">
              <span className="min-w-0 flex-1 truncate">{c.content}</span>
              <span className="shrink-0 text-[12.5px] text-gray-500">{relativeTime(c.created_at, nowMs)}</span>
            </li>
          ))}
          {!resurfacing.length && !recent.length && data.captures.length === 0 && (
            <li className="flex h-7 items-center text-[13px] text-ink-3">Thoughts, links, ideas. Sort them later.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
