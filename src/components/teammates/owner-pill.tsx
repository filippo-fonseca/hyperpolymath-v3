"use client";

import type { ReactNode } from "react";
import type { Bot, WidgetRow } from "@/lib/dashboard-types";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { stop } from "@/components/ui/primitives";
import { useDashboard } from "@/components/dashboard/context";

/** The full bot row for a widget's owner (the join only carries a few fields). */
export function widgetOwner(widget: WidgetRow, bots: Bot[]) {
  if (!widget.owner) return null;
  return bots.find((b) => b.id === widget.owner!.id) ?? { ...widget.owner, is_coordinator: false };
}

/**
 * "Made by" badge on a bot-owned widget: the bot's avatar and name. Opens that
 * bot in the Teammates view without opening the widget underneath.
 */
export function OwnerPill({
  bot,
  meta,
  compact = false,
}: {
  bot: { id: string; name: string; avatar_shape?: string | null; avatar_color?: string | null; is_coordinator?: boolean | null };
  meta?: ReactNode;
  compact?: boolean;
}) {
  const { openTeammates } = useDashboard();
  return (
    <button
      type="button"
      data-no-press
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        openTeammates({ botId: bot.id });
      }}
      title={`Made by ${bot.name}`}
      aria-label={`Made by ${bot.name}. Open in Teammates.`}
      className={`inline-flex h-[22px] min-w-0 shrink items-center gap-1.5 rounded-full bg-gray-100 text-[11.5px] font-medium text-gray-600 transition hover:bg-gray-150 hover:text-ink ${
        compact ? "w-[22px] justify-center" : "max-w-[60%] pl-[2px] pr-2"
      }`}
    >
      <BotAvatar bot={bot} size={18} />
      {!compact && <span className="truncate">{bot.name}</span>}
      {!compact && meta && <span className="shrink-0 font-normal text-ink-3">· {meta}</span>}
    </button>
  );
}
