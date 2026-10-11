"use server";

import { z } from "zod";
import {
  convertCaptureToTask,
  createCapture,
  deleteCapture,
  listCaptures,
  updateCapture,
} from "@/server/captures";
import { asUser, readAsUser } from "./run";

const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function createCaptureAction(content: string, resurfaceAt?: string | null) {
  return asUser((ctx) =>
    createCapture(ctx, { content: z.string().max(20000).parse(content), resurface_at: date.nullable().optional().parse(resurfaceAt) }),
  );
}

export async function searchCapturesAction(query: string, includeArchived: boolean) {
  return readAsUser((ctx) =>
    listCaptures(ctx, { query: z.string().max(200).parse(query) || undefined, includeArchived: !!includeArchived, limit: 100 }),
  );
}

export async function archiveCaptureAction(captureId: string, archived = true) {
  return asUser((ctx) => updateCapture(ctx, id.parse(captureId), { archived: !!archived }));
}

export async function resurfaceCaptureAction(captureId: string, resurfaceAt: string | null) {
  return asUser((ctx) => updateCapture(ctx, id.parse(captureId), { resurface_at: date.nullable().parse(resurfaceAt) }));
}

export async function deleteCaptureAction(captureId: string) {
  return asUser((ctx) => deleteCapture(ctx, id.parse(captureId)));
}

export async function convertCaptureAction(captureId: string) {
  return asUser((ctx) => convertCaptureToTask(ctx, id.parse(captureId)));
}
