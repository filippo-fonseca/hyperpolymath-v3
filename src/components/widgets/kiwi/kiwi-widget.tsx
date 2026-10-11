"use client";

import type { WidgetSize } from "@/lib/widgets";
import { localDate } from "@/lib/time";
import { relativeTime } from "@/lib/format";
import { useFitCount } from "@/components/ui/primitives";
import { KiwiMark } from "@/components/ui/brand";
import { useDashboard } from "@/components/dashboard/context";
import { ActorAvatar, botStatus, coordinatorOf, StatusDot } from "./actors";

const ROW_H = 30;
const STATUS_TEXT = { working: "Working", idle: "Idle", offline: "Not connected yet" } as const;

/** Kiwi's status and the latest things any teammate did. */
export function KiwiWidget({ size }: { size: WidgetSize }) {
  const { data, nowMs } = useDashboard();
  const kiwi = coordinatorOf(data.bots);
  const status = botStatus(kiwi, nowMs);
  const [listRef, fit] = useFitCount<HTMLDivElement>(ROW_H, size === "l" ? 6 : 2);
  const todayCount = data.actions.filter((a) => localDate(new Date(a.created_at), data.tz) === data.today).length;
  const name = kiwi?.name ?? "Kiwi";

  const header = (
    <div className="flex items-center gap-3">
      <KiwiMark size={size === "s" ? 34 : 30} className="shrink-0 text-ink" />
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold leading-tight">{name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-gray-500">
          <StatusDot status={status} />
          {STATUS_TEXT[status]}
          {status !== "offline" && kiwi?.last_seen_at && size !== "s" && (
            <span className="text-ink-3">· seen {relativeTime(kiwi.last_seen_at, nowMs)}</span>
          )}
        </div>
      </div>
    </div>
  );

  if (size === "s") {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="mt-auto">
          <div className="text-[34px] font-light leading-none tabular-nums tracking-[-0.02em]">{todayCount}</div>
          <div className="mt-1 text-[13px] text-gray-500">{todayCount === 1 ? "action today" : "actions today"}</div>
        </div>
      </div>
    );
  }

  const rows = data.actions.slice(0, fit);
  return (
    <div className="flex h-full flex-col">
      {header}
      <div ref={listRef} className="mt-3 min-h-0 flex-1 overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-[13px] leading-snug text-ink-3">
            {status === "offline"
              ? "Connect Grok Bot from Settings and Kiwi's work will show up here."
              : "No activity yet."}
          </p>
        ) : (
          <ul>
            {rows.map((a) => (
              <li key={a.id} className="flex h-[30px] items-center gap-2.5">
                <ActorAvatar action={a} bots={data.bots} size={20} />
                <span className={`min-w-0 flex-1 truncate text-[14px] ${a.reverted_at ? "text-ink-3 line-through" : ""}`}>
                  {a.summary}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-gray-500">{relativeTime(a.created_at, nowMs)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
