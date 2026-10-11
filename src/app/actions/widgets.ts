"use server";

import { z } from "zod";
import { listWidgets, removeWidget, saveLayout, widgetHistory } from "@/server/widgets";
import { isCustomKind } from "@/lib/widgets";
import { AppError, must } from "@/server/ctx";
import { logAction } from "@/server/log";
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
    stale_after_hours: z.number().int().min(1).max(24 * 60).nullable(),
    owner_bot_id: id.nullable(),
  })
  .partial();

/**
 * Edit a widget's title, staleness window or owner bot. There's no service
 * for these, so this is a minimal scoped write that is still logged (and so
 * revertible from Activity). Size and page go through saveLayoutAction.
 */
export async function updateWidgetAction(
  widgetId: string,
  patch: { title?: string; stale_after_hours?: number | null; owner_bot_id?: string | null },
) {
  return asUser(async (ctx) => {
    const wid = id.parse(widgetId);
    const p = widgetPatch.parse(patch);
    const before = must(
      await ctx.db.from("widgets").select().eq("id", wid).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle(),
      "widget",
    );
    const custom = isCustomKind(before.kind);
    if (!custom && (p.stale_after_hours !== undefined || p.owner_bot_id !== undefined)) {
      throw new AppError("Built-in widgets show live app data, so they have no owner or staleness window.");
    }
    if (p.owner_bot_id) {
      must(
        await ctx.db.from("bots").select("id").eq("id", p.owner_bot_id).eq("user_id", ctx.userId).maybeSingle(),
        "owner bot",
      );
    }
    const after = must(
      await ctx.db.from("widgets").update(p).eq("id", wid).eq("user_id", ctx.userId).select().single(),
      "update widget",
    );
    const what = [
      p.title !== undefined && p.title !== before.title ? `renamed to "${after.title}"` : null,
      p.owner_bot_id !== undefined && p.owner_bot_id !== before.owner_bot_id ? "owner changed" : null,
      p.stale_after_hours !== undefined && p.stale_after_hours !== before.stale_after_hours ? "staleness window changed" : null,
    ].filter(Boolean);
    await logAction(ctx, {
      tool: "update_widget",
      entityType: "widget",
      entityId: wid,
      before,
      after,
      summary: `Updated widget "${before.title}"${what.length ? ` (${what.join(", ")})` : ""}`,
    });
    return after;
  });
}
