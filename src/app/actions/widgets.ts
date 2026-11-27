"use server";

import { z } from "zod";
import { createWidget, listWidgets, publishWidget, removeWidget, saveLayout, updateWidget, widgetHistory } from "@/server/widgets";
import { getInsights, loadInsightsRaw } from "@/server/insights";
import { CUSTOM_KINDS, isCustomKind, WIDGET_SIZES, type CustomKind, type WidgetSize } from "@/lib/widgets";
import { daysNeeded, resolveSource, sourceSchema, SOURCE_INFO } from "@/lib/widget-sources";
import { AppError } from "@/server/ctx";
import { asUser, readAsUser } from "./run";

const id = z.string().uuid();
const layout = z
  .array(
    z.object({
      id,
      page: z.number().int().min(0).max(20),
      position: z.number().int().min(0).max(1000),
      size: z.enum(WIDGET_SIZES).optional(),
    }),
  )
  .max(200);

export async function saveLayoutAction(items: { id: string; page: number; position: number; size?: WidgetSize }[]) {
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

const kind = z.enum(CUSTOM_KINDS);

const widgetPatch = z
  .object({
    title: z.string().trim().min(1).max(120),
    icon: z.string().trim().max(500).nullable(),
    stale_after_hours: z.number().int().min(1).max(24 * 60).nullable(),
    owner_bot_id: id.nullable(),
    brief: z.string().max(2000).nullable(),
    source: sourceSchema.nullable(),
    kind,
  })
  .partial();

export type WidgetPatch = z.input<typeof widgetPatch>;

/** Edit a widget's title, icon, staleness window, owner bot, brief or live source (logged, revertible). */
export async function updateWidgetAction(widgetId: string, patch: WidgetPatch) {
  return asUser((ctx) => updateWidget(ctx, id.parse(widgetId), widgetPatch.parse(patch)));
}

const newWidget = z.object({
  kind,
  title: z.string().trim().min(1).max(60),
  size: z.enum(WIDGET_SIZES).optional(),
  icon: z.string().trim().max(500).nullable().optional(),
  stale_after_hours: z.number().int().min(1).max(24 * 60).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  source: sourceSchema.optional(),
  brief: z.string().max(2000).nullable().optional(),
  owner_bot_id: id.nullable().optional(),
});

export type NewWidget = z.input<typeof newWidget>;

/** Create a custom widget from the builder: written by you, live, or a brief for a bot. */
export async function createWidgetAction(input: NewWidget) {
  return asUser((ctx) => createWidget(ctx, newWidget.parse(input)));
}

/** Replace a widget's content from the builder, optionally as another kind. */
export async function publishWidgetAction(widgetId: string, payload: Record<string, unknown>, k?: CustomKind) {
  return asUser((ctx) => publishWidget(ctx, id.parse(widgetId), z.record(z.string(), z.unknown()).parse(payload), k ? kind.parse(k) : undefined));
}

/** What a live source looks like right now, for the builder's preview. */
export async function previewSourceAction(source: unknown, k: CustomKind) {
  return readAsUser(async (ctx) => {
    const src = sourceSchema.parse(source);
    const drawAs = kind.parse(k);
    if (!SOURCE_INFO[src.id].kinds.includes(drawAs)) throw new AppError(`That source can't be drawn as ${drawAs}.`);
    const raw = await loadInsightsRaw(ctx, daysNeeded([src]));
    return resolveSource(raw, src, drawAs) as Record<string, unknown>;
  });
}

/** Everything the Insights view draws, for every range at once. */
export async function insightsAction() {
  return readAsUser((ctx) => getInsights(ctx));
}
