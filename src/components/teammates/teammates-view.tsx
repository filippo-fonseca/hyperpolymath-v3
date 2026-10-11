"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import type { Bot, RoutineRow } from "@/lib/dashboard-types";
import { relativeTime } from "@/lib/format";
import { scheduleInWords } from "@/lib/cron-words";
import { updateRoutineAction } from "@/app/actions/teammates";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { Button, CloseButton, Sheet, Switch, useEscape, useMediaQuery, useScrollLock } from "@/components/ui/primitives";
import { IconPlus } from "@/components/ui/icons";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { useDashboard, type TeammatesFocus } from "@/components/dashboard/context";
import { botStatus, coordinatorOf, StatusDot } from "@/components/widgets/kiwi/actors";
import { RunDot, runState, WidgetChip } from "./routine-utils";
import { AddTeammate, BotEditor } from "./bot-sheet";
import { NewRoutine, RoutineEditor } from "./routine-sheet";

export type TeamSheet =
  | { kind: "bot"; id: string }
  | { kind: "routine"; id: string }
  | { kind: "new-routine"; botId: string }
  | { kind: "add-teammate" };

function initialSheet(focus: TeammatesFocus): TeamSheet | null {
  if (focus.routineId) return { kind: "routine", id: focus.routineId };
  if (focus.botId) return { kind: "bot", id: focus.botId };
  return null;
}

/**
 * Full-screen Teammates view: Kiwi at the top, every bot under it by parent,
 * and each bot's Grok Bot routines with an on/off switch. Opens over the
 * dashboard (and over the expanded Activity view) like a widget expands.
 */
export function TeammatesView({ focus, onClose }: { focus: TeammatesFocus; onClose: () => void }) {
  const desktop = useMediaQuery("(min-width: 640px)");
  const [sheet, setSheet] = useState<{ value: TeamSheet; open: boolean } | null>(() => {
    const s = initialSheet(focus);
    return s ? { value: s, open: true } : null;
  });
  const openSheet = (value: TeamSheet) => setSheet({ value, open: true });
  useEscape(onClose, !sheet?.open);
  useScrollLock(true);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center sm:p-6">
      <motion.div
        className="absolute inset-0 bg-[rgb(252_252_252/0.8)] backdrop-blur-[12px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.24 } }}
        transition={{ duration: 0.28 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Teammates"
        initial={{ opacity: 0, y: desktop ? 14 : 28, scale: desktop ? 0.985 : 1 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: desktop ? 8 : 28, transition: { duration: 0.2 } }}
        transition={{ type: "spring", duration: 0.38, bounce: 0 }}
        className="relative flex h-full w-full flex-col overflow-hidden bg-bg shadow-lift sm:h-[min(880px,calc(100dvh-48px))] sm:max-w-[980px]"
        style={{ borderRadius: desktop ? 28 : 0 }}
      >
        <CloseButton onClick={onClose} className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] z-20 sm:right-5 sm:top-5" />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-[max(20px,env(safe-area-inset-top))] sm:px-10 sm:pt-9">
            <ExpandedHeader
              eyebrow="Kiwi and teammates"
              title="Teammates"
              aside={
                <Button size="sm" variant="dark" onClick={() => openSheet({ kind: "add-teammate" })}>
                  <IconPlus size={14} /> Add teammate
                </Button>
              }
            />
            <p className="-mt-3 mb-6 text-[13px] leading-snug text-ink-3">
              Routines run in Grok Bot. Bots check in before each run, so switching one off pauses it.
            </p>
            <TeamTree onOpen={openSheet} />
          </div>
        </div>
      </motion.div>
      <TeamSheets
        sheet={sheet?.value ?? null}
        open={!!sheet?.open}
        onClose={() => setSheet((s) => (s ? { ...s, open: false } : s))}
        onSwitch={openSheet}
      />
    </div>
  );
}

/* ---------------- Sheets ---------------- */

function TeamSheets({
  sheet,
  open,
  onClose,
  onSwitch,
}: {
  sheet: TeamSheet | null;
  open: boolean;
  onClose: () => void;
  onSwitch: (s: TeamSheet) => void;
}) {
  const { data } = useDashboard();
  let title: ReactNode = "";
  let body: ReactNode = null;
  if (sheet?.kind === "bot") {
    const bot = data.bots.find((b) => b.id === sheet.id);
    title = bot ? (
      <span className="flex items-center gap-2.5">
        <BotAvatar bot={bot} size={26} />
        {bot.name}
      </span>
    ) : (
      "Teammate"
    );
    body = <BotEditor key={sheet.id} botId={sheet.id} onDone={onClose} />;
  } else if (sheet?.kind === "routine") {
    title = data.routines.find((r) => r.id === sheet.id)?.name ?? "Routine";
    body = <RoutineEditor key={sheet.id} routineId={sheet.id} onDone={onClose} />;
  } else if (sheet?.kind === "new-routine") {
    const bot = data.bots.find((b) => b.id === sheet.botId);
    title = bot ? `New routine for ${bot.name}` : "New routine";
    body = <NewRoutine key={sheet.botId} botId={sheet.botId} onDone={onClose} />;
  } else if (sheet?.kind === "add-teammate") {
    title = "Add teammate";
    body = <AddTeammate onAdded={(id) => onSwitch({ kind: "bot", id })} />;
  }
  return (
    <Sheet open={open && !!body} onClose={onClose} title={title} width={480}>
      {body}
    </Sheet>
  );
}

/* ---------------- Tree ---------------- */

function TeamTree({ onOpen }: { onOpen: (s: TeamSheet) => void }) {
  const { data } = useDashboard();
  const kiwi = coordinatorOf(data.bots);
  const childrenOf = (id: string) => data.bots.filter((b) => b.parent_id === id && b.id !== kiwi?.id);
  const roots = [
    ...(kiwi ? [kiwi] : []),
    ...data.bots.filter((b) => b.id !== kiwi?.id && (!b.parent_id || !data.bots.some((p) => p.id === b.parent_id))),
  ];

  if (data.bots.length === 0) {
    return (
      <div className="rounded-[20px] bg-surface px-5 py-10 text-center shadow-widget">
        <KiwiBlob size={44} className="mx-auto" />
        <p className="mx-auto mt-3 max-w-[300px] text-[14px] leading-snug text-ink-2">
          No teammates yet. Bots join the first time they act through MCP, or you can add one by hand.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {roots.map((b) => (
        <Branch key={b.id} bot={b} childrenOf={childrenOf} seen={new Set()} onOpen={onOpen} />
      ))}
    </div>
  );
}

function Branch({
  bot,
  childrenOf,
  seen,
  onOpen,
}: {
  bot: Bot;
  childrenOf: (id: string) => Bot[];
  seen: Set<string>;
  onOpen: (s: TeamSheet) => void;
}) {
  const { data } = useDashboard();
  // A parent cycle (A under B under A) must not recurse forever.
  const path = new Set(seen).add(bot.id);
  const kids = childrenOf(bot.id).filter((k) => !path.has(k.id));
  return (
    <div className="flex flex-col gap-3">
      <BotCard bot={bot} routines={data.routines.filter((r) => r.bot_id === bot.id)} onOpen={onOpen} />
      {kids.length > 0 && (
        <div className="ml-4 flex flex-col gap-3 border-l border-gray-200 pl-3 sm:ml-6 sm:pl-5">
          {kids.map((k) => (
            <div key={k.id} className="relative">
              <span aria-hidden className="absolute -left-3 top-8 h-px w-3 bg-gray-200 sm:-left-5 sm:w-5" />
              <Branch bot={k} childrenOf={childrenOf} seen={path} onOpen={onOpen} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Bot card ---------------- */

function BotCard({ bot, routines, onOpen }: { bot: Bot; routines: RoutineRow[]; onOpen: (s: TeamSheet) => void }) {
  const { data, nowMs } = useDashboard();
  const status = botStatus(bot, nowMs);
  const latestOwn = bot.is_coordinator ? data.actions.find((a) => a.bot_id === bot.id)?.id : undefined;

  return (
    <article className="overflow-hidden rounded-[20px] bg-surface shadow-widget">
      <button
        type="button"
        onClick={() => onOpen({ kind: "bot", id: bot.id })}
        className="flex w-full items-start gap-3 px-4 pb-3 pt-4 text-left transition hover:bg-gray-50"
      >
        {bot.is_coordinator ? (
          <KiwiBlob size={44} boinkKey={latestOwn} interactive={false} title={bot.name} />
        ) : (
          <BotAvatar bot={bot} size={40} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">{bot.name}</span>
            <StatusDot status={status} />
          </span>
          <span className="block truncate text-[13px] text-gray-500">
            {bot.role || (bot.is_coordinator ? "Coordinator" : "No role yet")}
          </span>
          {bot.description && (
            <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-ink-2">{bot.description}</span>
          )}
        </span>
        <span className="shrink-0 pt-0.5 text-right text-[12px] leading-tight text-ink-3">
          {bot.last_seen_at ? `seen ${relativeTime(bot.last_seen_at, nowMs)}` : "not seen yet"}
        </span>
      </button>
      <div className="px-4 pb-2">
        {routines.length > 0 && (
          <ul className="divide-y divide-gray-150 border-t border-gray-150">
            {routines.map((r) => (
              <RoutineItem key={r.id} routine={r} onOpen={() => onOpen({ kind: "routine", id: r.id })} />
            ))}
          </ul>
        )}
        <div className={routines.length ? "" : "border-t border-gray-150"}>
          <button
            type="button"
            onClick={() => onOpen({ kind: "new-routine", botId: bot.id })}
            className="-mx-2 my-1 flex h-8 items-center gap-1.5 rounded-full px-2 text-[13px] font-medium text-ink-3 transition hover:bg-gray-100 hover:text-ink-2"
          >
            <IconPlus size={14} /> Add routine
          </button>
        </div>
      </div>
    </article>
  );
}

function RoutineItem({ routine, onOpen }: { routine: RoutineRow; onOpen: () => void }) {
  const { nowMs, run } = useDashboard();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const enabled = optimistic ?? routine.enabled;
  const state = runState(routine.last_status, routine.last_run_at, nowMs);

  const toggle = async (next: boolean) => {
    setOptimistic(next);
    await run(updateRoutineAction(routine.id, { enabled: next }), {
      success: next ? `Resumed “${routine.name}”` : `Paused “${routine.name}”. The bot skips it from its next check-in.`,
    });
    setOptimistic(null);
  };

  return (
    <li className="flex items-start gap-3 py-3">
      <button type="button" onClick={onOpen} className="group min-w-0 flex-1 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`truncate text-[14.5px] font-medium group-hover:underline group-hover:decoration-gray-300 group-hover:underline-offset-2 ${
              enabled ? "" : "text-ink-3"
            }`}
          >
            {routine.name}
          </span>
          {routine.widget && <WidgetChip title={routine.widget.title} />}
        </span>
        <Meta>
          <span className="truncate">{scheduleInWords(routine.schedule)}</span>
          <span className="text-gray-300">·</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <RunDot className={state.dot} />
            {enabled ? state.text : "Paused"}
          </span>
        </Meta>
        {routine.last_summary && (
          <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">{routine.last_summary}</span>
        )}
      </button>
      <div className="pt-0.5">
        <Switch checked={enabled} onChange={toggle} label={`${enabled ? "Pause" : "Resume"} ${routine.name}`} />
      </div>
    </li>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-gray-500">{children}</span>;
}
