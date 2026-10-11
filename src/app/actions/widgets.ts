"use server";

import { z } from "zod";
import { listWidgets, removeWidget, saveLayout, updateWidget, widgetHistory } from "@/server/widgets";
import { isCustomKind } from "@/lib/widgets";
import { AppError } from "@/server/ctx";
import { asUser, readAsUser } from "./run";

const id = z.string().uuid();
const layout = z
  .array(
    z.object({
      id,
      page: z.number().int().min(0).max(20),
      position: z.number().int().min(0).max(1000),
      size: z.enum(["s", "m", "l"]).optional(),
    }),
  )
  .max(200);

export async function saveLayoutAction(items: { id: string; page: number; position: number; size?: "s" | "m" | "l" }[]) {
  // Layout tweaks are frequent and local state is already correct, so skip
  // the router refresh.
  return asUser((ctx) => saveLayout(ctx, layout.parse(items)), { write: false });
}

export async function removeWidgetAction(widgetId: string) {
  return asUser(async (ctx) => {
    const wid = id.parse(widgetId);
    const widget = (await listWidgets(ctx)).find((w) => w.id === wid);
    if (!widget) throw new AppError("That widget no longer exists.", "not_found");
    if (!isCustomKind(widget.kind)) throw new AppError("Built-in widgets can be moved and resized, not removed.");
    return removeWidget(ctx, wid);
  });
}

export async function widgetHistoryAction(widgetId: string) {
  return readAsUser((ctx) => widgetHistory(ctx, id.parse(widgetId), 30));
}

const widgetPatch = z
  .object({
    title: z.string().trim().min(1).max(120),
    icon: z.string().trim().max(500).nullable(),
    stale_after_hours: z.number().int().min(1).max(24 * 60).nullable(),
    owner_bot_id: id.nullable(),
  })
  .partial();

/** Edit a widget's title, icon, staleness window or owner bot (logged, revertible). */
export async function updateWidgetAction(
  widgetId: string,
  patch: { title?: string; icon?: string | null; stale_after_hours?: number | null; owner_bot_id?: string | null },
) {
  return asUser((ctx) => updateWidget(ctx, id.parse(widgetId), widgetPatch.parse(patch)));
}
