"use client";

import { relativeTime } from "@/lib/format";

/** Status dot color and label for a routine's (or a run's) last result. */
export function runState(status: string | null | undefined, at: string | null | undefined, nowMs: number) {
  if (!at) return { dot: "bg-gray-300", text: "Never run" };
  const when = relativeTime(at, nowMs);
  switch (status) {
    case "error":
      return { dot: "bg-danger", text: `Failed ${when}` };
    case "skipped":
      return { dot: "bg-gray-400", text: `Skipped ${when}` };
    case "running":
      return { dot: "bg-accent pulse-dot", text: `Started ${when}` };
    default:
      return { dot: "bg-success", text: `Ran ${when}` };
  }
}

export function RunDot({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${className}`} />;
}

/** Small chip naming the widget a routine publishes to. */
export function WidgetChip({ title }: { title: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-[140px] shrink items-center gap-1 rounded-full bg-gray-150 px-2 py-px text-[11.5px] font-medium text-gray-700">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="shrink-0">
        <rect x="0.5" y="0.5" width="4" height="4" rx="1.2" fill="currentColor" opacity="0.7" />
        <rect x="5.5" y="0.5" width="4" height="4" rx="1.2" fill="currentColor" opacity="0.45" />
        <rect x="0.5" y="5.5" width="9" height="4" rx="1.2" fill="currentColor" opacity="0.45" />
      </svg>
      <span className="truncate">{title}</span>
    </span>
  );
}
