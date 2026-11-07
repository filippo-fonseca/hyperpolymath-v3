"use server";

import { z } from "zod";
import { AppError } from "@/server/ctx";
import { updateProfile, uploadAvatar } from "@/server/profile";
import { asUser } from "./run";

/** Set or clear (empty string) the name shown on your captures and replies. */
export async function setDisplayNameAction(name: string) {
  return asUser((ctx) => updateProfile(ctx, { display_name: z.string().max(200).parse(name) }));
}

/** Upload a new photo. The form carries it as `avatar`. */
export async function uploadAvatarAction(form: FormData) {
  return asUser(async (ctx) => {
    const file = form.get("avatar");
    if (!(file instanceof Blob)) throw new AppError("Pick a photo first.");
    return uploadAvatar(ctx, file);
  });
}

export async function removeAvatarAction() {
  return asUser((ctx) => updateProfile(ctx, { avatar_url: null }));
}
