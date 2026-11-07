"use server";

import { z } from "zod";
import { addComment, deleteComment, listComments, updateComment } from "@/server/capture-comments";
import { asUser, readAsUser } from "./run";

const id = z.string().uuid();
const content = z.string().min(1).max(5000);

/** A capture's replies, oldest first. */
export async function listCommentsAction(captureId: string) {
  return readAsUser((ctx) => listComments(ctx, id.parse(captureId)));
}

export async function addCommentAction(captureId: string, text: string) {
  return asUser((ctx) => addComment(ctx, id.parse(captureId), content.parse(text)));
}

export async function updateCommentAction(commentId: string, text: string) {
  return asUser((ctx) => updateComment(ctx, id.parse(commentId), content.parse(text)));
}

export async function deleteCommentAction(commentId: string) {
  return asUser((ctx) => deleteComment(ctx, id.parse(commentId)));
}
