import "server-only";
import { AppError, escapeLike, must, type Ctx, type Row } from "./ctx";
import { logAction } from "./log";
import { createTask } from "./tasks";
import { createCapture } from "./captures";
import { projectIdFor } from "./projects";
import {
  DAILY_LIMIT_PER_SOURCE,
  DISMISS_MEMORY_DAYS,
  PENDING_LIMIT,
  dedupeKey,
  type SuggestionOutcome,
} from "@/lib/suggestions";

// Suggestions are tasks and captures a bot noticed on its own and proposes
// instead of creating. They wait in the Suggested tray until the owner
// accepts (creating the real thing, credited to the bot) or dismisses them.

export type Suggestion = Row<"suggestions">;
export type SuggestionWithBot = Suggestion & {
  bot: { id: string; name: string; avatar_shape: string; avatar_color: string } | null;
};

export type SuggestionInput = {
  kind: "task" | "capture";
  content: string;
  notes?: string | null;
  reason?: string | null;
  project?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  priority?: number;
};

export type SuggestResult = { content: string; outcome: SuggestionOutcome; id: string | null };

const DAY_MS = 86_400_000;

export async function listSuggestions(
  ctx: Ctx,
  opts: { status?: "pending" | "accepted" | "dismissed"; limit?: number } = {},
): Promise<SuggestionWithBot[]> {
  const rows = must(
    await ctx.db
      .from("suggestions")
      .select("*, bot:bots(id, name, avatar_shape, avatar_color)")
      .eq("user_id", ctx.userId)
      .eq("status", opts.status ?? "pending")
      .is("deleted_at", null)
      .order(opts.status && opts.status !== "pending" ? "resolved_at" : "created_at", { ascending: false })
      .limit(Math.min(opts.limit ?? 50, PENDING_LIMIT)),
    "list suggestions",
  );
  return rows as SuggestionWithBot[];
}

export async function pendingSuggestionCount(ctx: Ctx): Promise<number> {
  const { count, error } = await ctx.db
    .from("suggestions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("status", "pending")
    .is("deleted_at", null);
  if (error) throw new AppError(`count suggestions: ${error.message}`);
  return count ?? 0;
}

/** The longest word, to narrow a fuzzy lookup before comparing keys exactly. */
function probe(key: string) {
  return key.split(" ").reduce((a, b) => (b.length > a.length ? b : a), "");
}

/** Is this already an open task (for task suggestions) or a live capture? */
async function alreadyThere(ctx: Ctx, kind: SuggestionInput["kind"], key: string) {
  const word = probe(key);
  if (!word) return false;
  if (kind === "task") {
    const rows = must(
      await ctx.db
        .from("tasks")
        .select("title")
        .eq("user_id", ctx.userId)
        .is("deleted_at", null)
        .neq("status", "done")
        .ilike("title", `%${escapeLike(word)}%`)
        .limit(100),
      "check tasks",
    );
    return rows.some((r) => dedupeKey(r.title) === key);
  }
  const rows = must(
    await ctx.db
      .from("captures")
      .select("content")
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .ilike("content", `%${escapeLike(word)}%`)
      .limit(100),
    "check captures",
  );
  return rows.some((r) => dedupeKey(r.content) === key);
}

/**
 * Propose tasks and captures. Each item is checked against what's waiting,
 * what already exists and what the owner dismissed lately, so bots can call
 * this freely without flooding the tray. Over the daily or pending limit the
 * whole call is refused with a clear message.
 */
export async function suggest(ctx: Ctx, items: SuggestionInput[]): Promise<SuggestResult[]> {
  if (!items.length) return [];
  const source = ctx.actor.name.trim().slice(0, 60) || "bot";
  const since = new Date(ctx.now.getTime() - DAY_MS).toISOString();
  const [{ count: today }, pending] = await Promise.all([
    ctx.db
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .eq("source", source)
      .gte("created_at", since),
    pendingSuggestionCount(ctx),
  ]);
  if ((today ?? 0) + items.length > DAILY_LIMIT_PER_SOURCE) {
    throw new AppError(
      `Daily suggestion limit reached for ${source} (${DAILY_LIMIT_PER_SOURCE} a day). Keep only what matters most and try again tomorrow.`,
      "conflict",
    );
  }
  if (pending + items.length > PENDING_LIMIT) {
    throw new AppError(
      `The owner already has ${pending} suggestions waiting. Hold off until they review some.`,
      "conflict",
    );
  }

  const dismissedSince = new Date(ctx.now.getTime() - DISMISS_MEMORY_DAYS * DAY_MS).toISOString();
  const results: SuggestResult[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const content = item.content.trim().replace(/\s+/g, " ");
    if (!content) throw new AppError("A suggestion can't be empty.");
    const key = dedupeKey(content) || content.toLowerCase();
    const short = content.slice(0, 80);
    if (seen.has(`${item.kind}:${key}`)) {
      results.push({ content: short, outcome: "duplicate", id: null });
      continue;
    }
    seen.add(`${item.kind}:${key}`);

    const { data: earlier } = await ctx.db
      .from("suggestions")
      .select("id, status, resolved_at")
      .eq("user_id", ctx.userId)
      .eq("kind", item.kind)
      .eq("dedupe_key", key)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5);
    const waiting = earlier?.find((s) => s.status === "pending");
    if (waiting) {
      results.push({ content: short, outcome: "duplicate", id: waiting.id });
      continue;
    }
    const dismissed = earlier?.find((s) => s.status === "dismissed" && (s.resolved_at ?? "") >= dismissedSince);
    if (dismissed) {
      results.push({ content: short, outcome: "dismissed_before", id: dismissed.id });
      continue;
    }
    if (await alreadyThere(ctx, item.kind, key)) {
      results.push({ content: short, outcome: "exists", id: null });
      continue;
    }

    const row = must(
      await ctx.db
        .from("suggestions")
        .insert({
          user_id: ctx.userId,
          kind: item.kind,
          content,
          notes: item.kind === "task" ? (item.notes?.trim() || null) : null,
          reason: item.reason?.trim().slice(0, 500) || null,
          project_id: (await projectIdFor(ctx, item.project)) ?? null,
          due_date: item.kind === "task" ? (item.due_date ?? null) : null,
          due_time: item.kind === "task" && item.due_date ? (item.due_time ?? null) : null,
          priority: item.kind === "task" ? Math.max(0, Math.min(3, Math.round(item.priority ?? 0))) : 0,
          source,
          bot_id: ctx.actor.kind === "bot" ? ctx.actor.botId : null,
          dedupe_key: key,
        })
        .select()
        .single(),
      "create suggestion",
    );
    await logAction(ctx, {
      tool: "suggest",
      entityType: "suggestion",
      entityId: row.id,
      before: null,
      after: row,
      summary: `Suggested ${item.kind === "task" ? "a task" : "a capture"}: "${short}"`,
    });
    results.push({ content: short, outcome: "pending", id: row.id });
  }
  return results;
}

async function getPending(ctx: Ctx, id: string) {
  const row = must(
    await ctx.db.from("suggestions").select().eq("id", id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle(),
    `suggestion ${id}`,
  );
  if (row.status !== "pending") throw new AppError(`That suggestion was already ${row.status}.`, "conflict");
  return row;
}

export type AcceptEdits = {
  content?: string;
  project?: string | null;
  due_date?: string | null;
  priority?: number;
};

/**
 * Accept a suggestion: create the task or capture (credited to the bot that
 * suggested it) and mark the suggestion accepted. Reverting the accept in
 * Activity removes what it created and puts the suggestion back.
 */
export async function acceptSuggestion(ctx: Ctx, id: string, edits: AcceptEdits = {}) {
  const s = await getPending(ctx, id);
  const content = edits.content?.trim() || s.content;
  const project = edits.project !== undefined ? edits.project : s.project_id;
  let resultId: string;
  let created: Row<"tasks"> | Row<"captures">;
  if (s.kind === "task") {
    const notes = s.notes ?? (s.reason ? `Suggested by ${s.source}: ${s.reason}` : null);
    created = await createTask(
      ctx,
      {
        title: content,
        notes,
        project,
        due_date: edits.due_date !== undefined ? edits.due_date : s.due_date,
        due_time: edits.due_date !== undefined ? null : s.due_time,
        priority: edits.priority ?? s.priority,
      },
      { by: s.source },
    );
    resultId = created.id;
  } else {
    created = await createCapture(ctx, { content, project }, { by: s.source });
    resultId = created.id;
  }

  const after = must(
    await ctx.db
      .from("suggestions")
      .update({ status: "accepted", resolved_at: ctx.now.toISOString(), result_id: resultId })
      .eq("id", s.id)
      .eq("user_id", ctx.userId)
      .eq("status", "pending")
      .select()
      .single(),
    "accept suggestion",
  );
  await logAction(ctx, {
    tool: "accept_suggestion",
    entityType: "suggestion",
    entityId: s.id,
    before: s,
    after,
    summary: `Accepted ${s.source}'s suggestion: "${content.slice(0, 60)}"`,
  });
  return { suggestion: after, kind: s.kind, created };
}

export async function dismissSuggestion(ctx: Ctx, id: string) {
  const s = await getPending(ctx, id);
  const after = must(
    await ctx.db
      .from("suggestions")
      .update({ status: "dismissed", resolved_at: ctx.now.toISOString() })
      .eq("id", s.id)
      .eq("user_id", ctx.userId)
      .eq("status", "pending")
      .select()
      .single(),
    "dismiss suggestion",
  );
  await logAction(ctx, {
    tool: "dismiss_suggestion",
    entityType: "suggestion",
    entityId: s.id,
    before: s,
    after,
    summary: `Dismissed ${s.source}'s suggestion: "${s.content.slice(0, 60)}"`,
  });
  return after;
}

/** Accept or dismiss many at once (the tray's "Accept all"); stops at the first failure. */
export async function reviewSuggestions(ctx: Ctx, ids: string[], decision: "accept" | "dismiss") {
  const done: string[] = [];
  for (const id of ids) {
    if (decision === "accept") await acceptSuggestion(ctx, id);
    else await dismissSuggestion(ctx, id);
    done.push(id);
  }
  return { [decision === "accept" ? "accepted" : "dismissed"]: done.length };
}
