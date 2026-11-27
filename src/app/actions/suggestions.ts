"use server";

import { z } from "zod";
import { acceptSuggestion, dismissSuggestion, reviewSuggestions } from "@/server/suggestions";
import { isLocalDate } from "@/lib/time";
import { asUser } from "./run";

const id = z.string().uuid();

/** Accept a bot's suggestion, optionally with your edits (text, project, due date). */
export async function acceptSuggestionAction(
  suggestionId: string,
  edits: { content?: string; projectId?: string | null; dueDate?: string | null } = {},
) {
  return asUser(async (ctx) => {
    const r = await acceptSuggestion(ctx, id.parse(suggestionId), {
      content: z.string().trim().min(1).max(2000).optional().parse(edits.content),
      project: id.nullable().optional().parse(edits.projectId),
      due_date: z.string().refine(isLocalDate).nullable().optional().parse(edits.dueDate),
    });
    return { kind: r.kind, id: r.created.id };
  });
}

export async function dismissSuggestionAction(suggestionId: string) {
  return asUser(async (ctx) => {
    await dismissSuggestion(ctx, id.parse(suggestionId));
    return true;
  });
}

/** Accept or dismiss everything in the tray at once. */
export async function reviewAllSuggestionsAction(ids: string[], decision: "accept" | "dismiss") {
  return asUser((ctx) =>
    reviewSuggestions(ctx, z.array(id).max(100).parse(ids), z.enum(["accept", "dismiss"]).parse(decision)),
  );
}
