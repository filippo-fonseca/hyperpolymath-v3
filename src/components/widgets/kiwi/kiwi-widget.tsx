"use client";

import type { ActionRow, Bot } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { localDate } from "@/lib/time";
import { relativeTime } from "@/lib/format";
import { useFitCount } from "@/components/ui/primitives";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { KiwiTeam } from "@/components/illustrations";
import { useDashboard } from "@/components/dashboard/context";
import { WidgetHeader } from "@/components/dashboard/widget-chrome";
import { ActorAvatar, actorName, botStatus, coordinatorOf, StatusDot } from "./actors";

const ROW_H = 30;
const STATUS_TEXT = { working: "Working", idle: "Idle", offline: "Not connected yet" } as const;

/** Kiwi's status and the latest things any teammate did. */
export function KiwiWidget({ size }: { size: WidgetSize }) {
  const { data, nowMs, openTeammates } = useDashboard();
  const kiwi = coordinatorOf(data.bots);
  const status = botStatus(kiwi, nowMs);
  const [listRef, fit] = useFitCount<HTMLDivElement>(ROW_H, size === "l" ? 6 : 2);
  const todays = data.actions.filter((a) => localDate(new Date(a.created_at), data.tz) === data.today);
  const name = kiwi?.name ?? "Kiwi";
  const team = data.bots.filter((b) => b.id !== kiwi?.id);
  const meta = (
    <>
      <StatusDot status={status} />
      {STATUS_TEXT[status]}
    </>
  );

  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <KiwiBlob size={size === "s" ? 38 : 34} boinkKey={data.actions[0]?.id} />
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold leading-tight">{name}</div>
        <div className="mt-0.5 truncate text-[12.5px] text-gray-500">
          {status !== "offline" && kiwi?.last_seen_at ? `Seen ${relativeTime(kiwi.last_seen_at, nowMs)}` : kiwi?.role ?? "Your coordinator"}
        </div>
      </div>
    </div>
  );

  const teamButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openTeammates();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="Open teammates"
      className="-mr-1.5 ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-[12.5px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-ink"
    >
      {team.length > 0 && (
        <span className="flex -space-x-1.5">
          {team.slice(0, 3).map((b) => (
            <span key={b.id} className="rounded-full bg-surface p-px">
              <BotAvatar bot={b} size={18} />
            </span>
          ))}
        </span>
      )}
      Team
    </button>
  );

  if (size === "s") {
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader meta={<StatusDot status={status} />} />
        <div className="mt-1">{identity}</div>
        <div className="mt-auto">
          <div className="text-[34px] font-light leading-none tabular-nums tracking-[-0.02em]">{todays.length}</div>
          <div className="mt-1 text-[13px] text-gray-500">{todays.length === 1 ? "action today" : "actions today"}</div>
        </div>
      </div>
    );
  }

  const empty =
    data.actions.length === 0 && status === "offline" ? (
      <div className={`flex h-full items-center justify-center ${size === "m" ? "gap-3" : "flex-col gap-1 text-center"}`}>
        <KiwiTeam size={size === "m" ? 72 : 132} className="shrink-0" />
        <p className="max-w-[260px] text-[13px] leading-snug text-ink-3">Connect Grok Bot from Settings and Kiwi&apos;s work will show up here.</p>
      </div>
    ) : data.actions.length === 0 ? (
      <p className="text-[13px] leading-snug text-ink-3">No activity yet. Anything Kiwi or a teammate changes shows up here, with undo.</p>
    ) : null;

  if (size === "w") {
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader meta={meta} />
        <div className="mt-2 flex min-h-0 flex-1 gap-8">
          <div className="flex w-[240px] shrink-0 flex-col">
            {identity}
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Today" value={todays.length} />
              <Stat label="Undone today" value={todays.filter((a) => a.reverted_at).length} />
            </dl>
            <div className="mt-4 flex items-center justify-between text-[12px] font-semibold text-gray-500">
              Teammates
              {teamButton}
            </div>
            <ul className="mt-1 min-h-0 flex-1 overflow-hidden">
              {team.length === 0 ? (
                <li className="text-[13px] text-ink-3">Just Kiwi for now.</li>
              ) : (
                team.slice(0, 4).map((b) => <TeamRow key={b.id} bot={b} nowMs={nowMs} />)
              )}
            </ul>
          </div>
          <div ref={listRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {empty ?? <ActionRows actions={data.actions.slice(0, fit)} bots={data.bots} nowMs={nowMs} named />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <WidgetHeader meta={meta} />
      <div className="mt-1 flex items-center gap-3">
        {identity}
        {teamButton}
      </div>
      {size === "l" && data.actions.length > 0 && (
        <div className="mt-3 flex gap-2">
          <Pill>{todays.length === 1 ? "1 action today" : `${todays.length} actions today`}</Pill>
          {team.length > 0 && <Pill>{team.length === 1 ? "1 teammate" : `${team.length} teammates`}</Pill>}
        </div>
      )}
      <div ref={listRef} className="mt-3 min-h-0 flex-1 overflow-hidden">
        {empty ?? <ActionRows actions={data.actions.slice(0, fit)} bots={data.bots} nowMs={nowMs} named={size === "l"} />}
      </div>
    </div>
  );
}

function ActionRows({ actions, bots, nowMs, named }: { actions: ActionRow[]; bots: Bot[]; nowMs: number; named: boolean }) {
  return (
    <ul>
      {actions.map((a) => (
        <li key={a.id} className="flex h-[30px] items-center gap-2.5">
          <ActorAvatar action={a} bots={bots} size={20} />
          <span className={`min-w-0 flex-1 truncate text-[14px] ${a.reverted_at ? "text-ink-3 line-through" : ""}`}>
            {named && <span className="font-semibold">{actorName(a, bots)} </span>}
            {a.summary}
          </span>
          <span className="shrink-0 text-[12px] tabular-nums text-gray-500">{relativeTime(a.created_at, nowMs)}</span>
        </li>
      ))}
    </ul>
  );
}

function TeamRow({ bot, nowMs }: { bot: Bot; nowMs: number }) {
  const status = botStatus(bot, nowMs);
  return (
    <li className="flex h-8 items-center gap-2.5">
      <BotAvatar bot={bot} size={22} />
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{bot.name}</span>
      <StatusDot status={status} />
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11.5px] font-medium text-gray-500">{label}</dt>
      <dd className="text-[22px] font-light tabular-nums leading-tight tracking-[-0.02em]">{value}</dd>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[12px] font-medium text-ink-2">{children}</span>;
}
