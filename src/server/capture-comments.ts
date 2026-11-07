import "server-only";
import { AppError, must, type Ctx, type Row } from "./ctx";
import { logAction } from "./log";
import { getCapture } from "./captures";

// Replies on captures: a short thread under each one, from you or a bot.

export type CaptureComment = Row<"capture_comments"> & {
  bot: { id: string; name: string; avatar_shape: string; avatar_color: string; is_coordinator: boolean } | null;
};

const MAX = 5000;
const SELECT = "*, bot:bots(id, name, avatar_shape, avatar_color, is_coordinator)";

const clean = (content: string) => {
  const text = content.trim();
  if (!text) throw new AppError("A reply can't be empty.");
  if (text.length > MAX) throw new AppError("Keep replies under 5,000 characters.");
  return text;
};

const short = (s: string) => (s.length > 50 ? `${s.slice(0, 50)}…` : s);

/** A capture's replies, oldest first. */
export async function listComments(ctx: Ctx, captureId: string): Promise<CaptureComment[]> {
  const rows = must(
    await ctx.db
      .from("capture_comments")
      .select(SELECT)
      .eq("user_id", ctx.userId)
      .eq("capture_id", captureId)
      .is("deleted_at", null)
      .order("created_at")
      .limit(500),
    "list replies",
  );
  return rows as CaptureComment[];
}

/** Reply to a capture as whoever is acting (you, or the calling bot). */
export async function addComment(ctx: Ctx, captureId: string, content: string): Promise<CaptureComment> {
  const capture = await getCapture(ctx, captureId);
  const comment = must(
    await ctx.db
      .from("capture_comments")
      .insert({
        user_id: ctx.userId,
        capture_id: capture.id,
        content: clean(content),
        author_kind: ctx.actor.kind === "bot" ? "bot" : "user",
        bot_id: ctx.actor.kind === "bot" ? ctx.actor.botId : null,
      })
      .select(SELECT)
      .single(),
    "add reply",
  );
  await logAction(ctx, {
    tool: "add_capture_comment",
    entityType: "capture_comment",
    entityId: comment.id,
    before: null,
    after: comment,
    summary: `Replied to "${short(capture.content)}"`,
  });
  return comment as CaptureComment;
}

async function getComment(ctx: Ctx, id: string) {
  const comment = must(
    await ctx.db.from("capture_comments").select().eq("id", id).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle(),
    `reply ${id}`,
  );
  // Bots only change their own replies; you can change any reply in your space.
  if (ctx.actor.kind === "bot" && comment.bot_id !== ctx.actor.botId) {
    throw new AppError("Bots can only change their own replies.", "unauthorized");
  }
  return comment;
}

export async function updateComment(ctx: Ctx, id: string, content: string) {
  const before = await getComment(ctx, id);
  const after = must(
    await ctx.db
      .from("capture_comments")
      .update({ content: clean(content) })
      .eq("id", id)
      .eq("user_id", ctx.userId)
      .select()
      .single(),
    "edit reply",
  );
  await logAction(ctx, {
    tool: "update_capture_comment",
    entityType: "capture_comment",
    entityId: id,
    before,
    after,
    summary: `Edited a reply: "${short(after.content)}"`,
  });
  return after;
}

/** Soft delete, so the activity log can bring it back. */
export async function deleteComment(ctx: Ctx, id: string) {
  const before = await getComment(ctx, id);
  const after = must(
    await ctx.db
      .from("capture_comments")
      .update({ deleted_at: ctx.now.toISOString() })
      .eq("id", id)
      .eq("user_id", ctx.userId)
      .select()
      .single(),
    "delete reply",
  );
  await logAction(ctx, {
    tool: "delete_capture_comment",
    entityType: "capture_comment",
    entityId: id,
    before,
    after,
    summary: `Deleted a reply: "${short(before.content)}"`,
  });
  return { deleted: true };
}
