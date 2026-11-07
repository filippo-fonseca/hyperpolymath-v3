import "server-only";
import { AppError, must, type Ctx } from "./ctx";
import { logAction } from "./log";
import { AVATAR_MAX_BYTES, avatarExtension, sniffImageType } from "@/lib/avatar";

// Your name and photo, shown on captures and replies. profiles rows are keyed
// by id (the account id) rather than user_id.

export type Profile = { email: string; display_name: string | null; avatar_url: string | null };

const BUCKET = "avatars";

export async function getProfile(ctx: Ctx): Promise<Profile> {
  const { data, error } = await ctx.db
    .from("profiles")
    .select("email, display_name, avatar_url")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (error) throw new AppError(`profile: ${error.message}`);
  return data ?? { email: "", display_name: null, avatar_url: null };
}

async function profileRow(ctx: Ctx) {
  return must(await ctx.db.from("profiles").select().eq("id", ctx.userId).maybeSingle(), "profile");
}

export async function updateProfile(ctx: Ctx, patch: { display_name?: string | null; avatar_url?: string | null }) {
  const before = await profileRow(ctx);
  const values: { display_name?: string | null; avatar_url?: string | null } = {};
  if (patch.display_name !== undefined) {
    const name = patch.display_name?.trim() || null;
    if (name && name.length > 80) throw new AppError("Keep your name under 80 characters.");
    values.display_name = name;
  }
  if (patch.avatar_url !== undefined) values.avatar_url = patch.avatar_url;
  if (!Object.keys(values).length) return before;
  const after = must(
    await ctx.db.from("profiles").update(values).eq("id", ctx.userId).select().single(),
    "update profile",
  );
  const what =
    values.avatar_url !== undefined && values.display_name === undefined
      ? values.avatar_url
        ? "Changed your photo"
        : "Removed your photo"
      : values.display_name
        ? `Changed your name to "${values.display_name}"`
        : "Cleared your name";
  await logAction(ctx, {
    tool: "update_profile",
    entityType: "profile",
    entityId: ctx.userId,
    before,
    after,
    summary: what,
  });
  return after;
}

/**
 * Store a new photo under `<user_id>/` in the public avatars bucket and point
 * the profile at it. Old files stay, so reverting the change brings the
 * previous photo back.
 */
export async function uploadAvatar(ctx: Ctx, file: Blob) {
  if (!file || file.size === 0) throw new AppError("Pick a photo first.");
  if (file.size > AVATAR_MAX_BYTES) throw new AppError("That photo is over 2 MB. Try a smaller one.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) throw new AppError("Use a JPG, PNG, WebP or GIF image.");
  const path = `${ctx.userId}/${ctx.now.getTime()}.${avatarExtension(type)}`;
  const { error } = await ctx.db.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (error) throw new AppError(`Couldn't upload that photo: ${error.message}`);
  const { data } = ctx.db.storage.from(BUCKET).getPublicUrl(path);
  return updateProfile(ctx, { avatar_url: data.publicUrl });
}
