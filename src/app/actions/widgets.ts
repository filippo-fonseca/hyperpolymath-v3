"use server";

import { z } from "zod";
import { listWidgets, removeWidget, saveLayout, widgetHistory } from "@/server/widgets";
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
