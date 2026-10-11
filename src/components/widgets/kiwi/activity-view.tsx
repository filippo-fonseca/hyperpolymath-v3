"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ActionRow, Bot } from "@/lib/dashboard-types";
import { relativeTime } from "@/lib/format";
import { archiveBotAction, loadActionsAction, revertActionAction } from "@/app/actions/activity";
import { Button } from "@/components/ui/primitives";
import { IconUndo } from "@/components/ui/icons";
import { BotAvatar, YouAvatar } from "@/components/ui/bot-avatar";
import { useToast } from "@/components/ui/toast";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { useDashboard } from "@/components/dashboard/context";
import { ActorAvatar, actorName, botStatus, coordinatorOf, StatusDot } from "./actors";

type Filter = { kind: "all" } | { kind: "you" } | { kind: "bot"; id: string };

const ENTITY_LABEL: Record<string, string> = {
  task: "task",
  reminder: "reminder",
  habit: "habit",
  habit_log: "habit log",
  capture: "capture",
  widget: "widget",
  bot: "teammate",
  event: "event",
};

export function ActivityView() {
  const { data, run, openTeammates } = useDashboard();
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [fetched, setFetched] = useState<{ key: string; rows: ActionRow[]; done: boolean } | null>(null);
  const [extra, setExtra] = useState<ActionRow[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const botId = filter.kind === "bot" ? filter.id : null;

  // Per-bot timelines come from the server; refetch when fresh data arrives.
  useEffect(() => {
    if (!botId) return;
    let live = true;
    void run(loadActionsAction({ botId, limit: 60 }), { quiet: true }).then((rows) => {
      if (live && rows) setFetched({ key: botId, rows, done: rows.length < 60 });
    });
    return () => {
      live = false;
    };
  }, [botId, run, data.actions]);

  const base =
    filter.kind === "all"
      ? data.actions
      : filter.kind === "you"
        ? data.actions.filter((a) => a.actor_kind === "user")
        : fetched?.key === botId
          ? fetched.rows
          : [];
  const seen = new Set(base.map((a) => a.id));
  const rows = [...base, ...extra.filter((a) => !seen.has(a.id))];
  const canLoadMore = filter.kind === "all" ? data.actions.length >= 100 : filter.kind === "bot" ? !fetched?.done : false;

  const loadMore = async () => {
    const last = rows[rows.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const more = await run(loadActionsAction({ botId, before: last.created_at, limit: 60 }));
    setLoadingMore(false);
    if (more) setExtra((e) => [...e, ...more]);
  };

  const pick = (f: Filter) => {
    setFilter(f);
    setExtra([]);
  };

  return (
    <div>
      <ExpandedHeader
        eyebrow="Kiwi and teammates"
        title="Activity"
        aside={
          <Button size="sm" variant="soft" onClick={() => openTeammates(botId ? { botId } : {})}>
            Teammates and routines
          </Button>
        }
      />
      <div className="grid gap-8 md:grid-cols-[250px_minmax(0,1fr)]">
        <aside>
          <TeamTree filter={filter} onPick={pick} />
        </aside>
        <section className="min-w-0">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-[14px] text-ink-3">
              {filter.kind === "bot" && fetched?.key !== botId ? "Loading…" : "Nothing here yet."}
            </div>
          ) : (
            <ol className="relative">
              {rows.map((a, i) => (
                <TimelineRow key={a.id} action={a} last={i === rows.length - 1} />
              ))}
            </ol>
          )}
          {canLoadMore && rows.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Button size="sm" variant="soft" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------------- Teammates tree ---------------- */

function TeamTree({ filter, onPick }: { filter: Filter; onPick: (f: Filter) => void }) {
  const { data, nowMs } = useDashboard();
  const kiwi = coordinatorOf(data.bots);
  const children = (id: string) => data.bots.filter((b) => b.parent_id === id && b.id !== kiwi?.id);
  const roots = data.bots.filter((b) => b.id !== kiwi?.id && (!b.parent_id || !data.bots.some((p) => p.id === b.parent_id)));

  const node = (selected: boolean) =>
    `group flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition ${
      selected ? "bg-gray-150" : "hover:bg-gray-100"
    }`;

  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" className={node(filter.kind === "all")} onClick={() => onPick({ kind: "all" })}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-150 text-[11px] font-semibold text-gray-600">
          All
        </span>
        <span className="text-[14px] font-medium">All activity</span>
      </button>
      <button type="button" className={node(filter.kind === "you")} onClick={() => onPick({ kind: "you" })}>
        <YouAvatar size={28} />
        <span className="text-[14px] font-medium">You</span>
      </button>
      {kiwi && (
        <>
          <BotNode bot={kiwi} selected={filter.kind === "bot" && filter.id === kiwi.id} onPick={onPick} nowMs={nowMs} className={node} />
          <TreeChildren bots={children(kiwi.id)} childrenOf={children} filter={filter} onPick={onPick} nowMs={nowMs} className={node} />
        </>
      )}
      {roots.map((b) => (
        <div key={b.id}>
          <BotNode bot={b} selected={filter.kind === "bot" && filter.id === b.id} onPick={onPick} nowMs={nowMs} className={node} />
          <TreeChildren bots={children(b.id)} childrenOf={children} filter={filter} onPick={onPick} nowMs={nowMs} className={node} />
        </div>
      ))}
      {data.bots.length === 0 && (
        <p className="px-2.5 pt-2 text-[13px] leading-snug text-ink-3">
          Bots register themselves the first time they act through MCP.
        </p>
      )}
    </div>
  );
}

function TreeChildren({
  bots,
  childrenOf,
  filter,
  onPick,
  nowMs,
  className,
}: {
  bots: Bot[];
  childrenOf: (id: string) => Bot[];
  filter: Filter;
  onPick: (f: Filter) => void;
  nowMs: number;
  className: (selected: boolean) => string;
}) {
  if (!bots.length) return null;
  return (
    <ul className="relative ml-[23px] border-l border-gray-200 pl-0">
      {bots.map((b) => (
        <li key={b.id} className="relative pl-3">
          <span aria-hidden className="absolute left-0 top-[22px] h-px w-3 bg-gray-200" />
          <BotNode bot={b} selected={filter.kind === "bot" && filter.id === b.id} onPick={onPick} nowMs={nowMs} className={className} />
          <TreeChildren bots={childrenOf(b.id)} childrenOf={childrenOf} filter={filter} onPick={onPick} nowMs={nowMs} className={className} />
        </li>
      ))}
    </ul>
  );
}

function BotNode({
  bot,
  selected,
  onPick,
  nowMs,
  className,
}: {
  bot: Bot;
  selected: boolean;
  onPick: (f: Filter) => void;
  nowMs: number;
  className: (selected: boolean) => string;
}) {
  const { run } = useDashboard();
  const [confirm, setConfirm] = useState(false);
  const status = botStatus(bot, nowMs);
  return (
    <div>
      <button type="button" className={className(selected)} onClick={() => onPick({ kind: "bot", id: bot.id })}>
        <BotAvatar bot={bot} size={28} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-medium">{bot.name}</span>
            <StatusDot status={status} />
          </span>
          {(bot.role || bot.description) && (
            <span className="block truncate text-[12.5px] text-gray-500">{bot.role || bot.description}</span>
          )}
        </span>
        <span className="shrink-0 text-[11.5px] tabular-nums text-ink-3">
          {bot.last_seen_at ? relativeTime(bot.last_seen_at, nowMs) : ""}
        </span>
      </button>
      {selected && !bot.is_coordinator && (
        <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-0.5">
          {confirm ? (
            <>
              <span className="flex-1 text-[12.5px] text-ink-2">Archive {bot.name}? History stays.</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="dark"
                onClick={async () => {
                  const ok = await run(archiveBotAction(bot.name), { success: `Archived ${bot.name}` });
                  if (ok) onPick({ kind: "all" });
                }}
              >
                Archive
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="text-ink-3" onClick={() => setConfirm(true)}>
              Archive teammate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Timeline ---------------- */

function TimelineRow({ action, last }: { action: ActionRow; last: boolean }) {
  const { data, nowMs, run } = useDashboard();
  const toast = useToast();
  const [stage, setStage] = useState<"idle" | "confirm" | "conflict" | "busy">("idle");
  const [conflictMsg, setConflictMsg] = useState("");
  const [localReverted, setLocalReverted] = useState(false);
  const reverted = !!action.reverted_at || localReverted;
  const name = actorName(action, data.bots);

  const revert = async (force: boolean) => {
    setStage("busy");
    let res;
    try {
      res = await revertActionAction(action.id, force);
    } catch {
      setStage("confirm");
      toast.error("Couldn't reach the server. Check your connection.");
      return;
    }
    if (!res.ok) {
      if (res.code === "conflict" && !force && !/already reverted/i.test(res.error)) {
        setConflictMsg(res.error);
        setStage("conflict");
      } else {
        toast.error(res.error);
        setStage("idle");
      }
      return;
    }
    setLocalReverted(true);
    setStage("idle");
    const undoId = res.data.undo_id;
    toast.show("Reverted", {
      action: undoId
        ? { label: "Undo", onClick: () => void run(revertActionAction(undoId, true), { success: "Restored" }) }
        : undefined,
    });
  };

  return (
    <li className="relative flex gap-3.5 pb-1">
      <div className="relative flex w-6 shrink-0 flex-col items-center">
        <span className="relative z-10 mt-2.5 rounded-full bg-surface">
          <ActorAvatar action={action} bots={data.bots} size={24} />
        </span>
        {!last && <span aria-hidden className="absolute bottom-0 top-9 w-px bg-gray-200" />}
      </div>
      <div className="min-w-0 flex-1 py-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className={`text-[15px] font-medium leading-snug ${reverted ? "text-ink-3 line-through decoration-gray-400" : ""}`}>
              {action.summary}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-500">
              <span>{name}</span>
              <span className="text-gray-300">·</span>
              <span>{relativeTime(action.created_at, nowMs)}</span>
              <span className="rounded-[6px] bg-gray-100 px-1.5 py-px font-mono text-[11.5px] text-gray-600">{action.tool}</span>
              {ENTITY_LABEL[action.entity_type] && action.entity_type !== "task" && (
                <span className="text-ink-3">{ENTITY_LABEL[action.entity_type]}</span>
              )}
              {reverted && <span className="rounded-full bg-gray-150 px-2 py-px text-[11.5px] font-medium text-gray-600">Reverted</span>}
            </div>
          </div>
          {!reverted && action.entity_id && stage === "idle" && (
            <button
              type="button"
              onClick={() => setStage("confirm")}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-gray-700 transition hover:bg-gray-100"
            >
              <IconUndo size={15} /> Revert
            </button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {(stage === "confirm" || stage === "conflict" || stage === "busy") && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-2.5 rounded-[16px] bg-gray-50 p-3.5 shadow-ring">
                <p className="text-[14px] font-semibold">{stage === "conflict" ? "This changed since" : "Revert this action?"}</p>
                <p className="mt-0.5 text-[13.5px] leading-snug text-ink-2">
                  {stage === "conflict"
                    ? conflictMsg
                    : `This puts the ${ENTITY_LABEL[action.entity_type] ?? "item"} back the way it was before.`}
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setStage("idle")} disabled={stage === "busy"}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="dark" disabled={stage === "busy"} onClick={() => revert(stage === "conflict")}>
                    {stage === "conflict" ? "Revert anyway" : stage === "busy" ? "Reverting…" : "Revert"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}
