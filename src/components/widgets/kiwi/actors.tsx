"use client";

import type { ActionRow, Bot } from "@/lib/dashboard-types";
import { BotAvatar, YouAvatar } from "@/components/ui/bot-avatar";

export function coordinatorOf(bots: Bot[]): Bot | null {
  return bots.find((b) => b.is_coordinator) ?? bots.find((b) => b.name.toLowerCase() === "kiwi") ?? null;
}

/** Full bot row for an action's actor (the join only carries a few fields). */
export function actorBot(a: ActionRow, bots: Bot[]) {
  if (!a.bot_id) return null;
  return bots.find((b) => b.id === a.bot_id) ?? (a.bot ? { ...a.bot, is_coordinator: false } : null);
}

export function actorName(a: ActionRow, bots: Bot[]) {
  if (a.actor_kind === "user") return "You";
  return actorBot(a, bots)?.name ?? (a.actor_kind === "system" ? "System" : "A bot");
}

export function ActorAvatar({ action, bots, size = 24 }: { action: ActionRow; bots: Bot[]; size?: number }) {
  const bot = actorBot(action, bots);
  if (action.actor_kind === "user" || !bot) return <YouAvatar size={size} />;
  return <BotAvatar bot={bot} size={size} />;
}

export type BotStatus = "working" | "idle" | "offline";

/** Working if seen in the last two minutes, idle if ever seen. */
export function botStatus(bot: Bot | null, nowMs: number): BotStatus {
  if (!bot?.last_seen_at) return "offline";
  return nowMs - Date.parse(bot.last_seen_at) < 120_000 ? "working" : "idle";
}

export function StatusDot({ status }: { status: BotStatus }) {
  const cls =
    status === "working" ? "bg-accent pulse-dot" : status === "idle" ? "bg-success" : "bg-gray-300";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} aria-label={status} />;
}
