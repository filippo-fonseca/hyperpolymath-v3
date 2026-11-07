"use server";

import { z } from "zod";
import {
  convertCaptureToTask,
  createCapture,
  deleteCapture,
  listCaptures,
  markCaptureSeen,
  setResurface,
  updateCapture,
} from "@/server/captures";
import { scheduleSchema, type Schedule } from "@/lib/schedule";
import { asUser, readAsUser } from "./run";

const id = z.string().uuid();

export async function createCaptureAction(content: string, resurface?: Schedule | null, projectId?: string | null) {
  return asUser((ctx) =>
    createCapture(ctx, {
      content: z.string().max(20000).parse(content),
      resurface: scheduleSchema.nullable().optional().parse(resurface),
      project: id.nullable().optional().parse(projectId),
    }),
  );
}

/** Edit a capture's text. */
export async function editCaptureAction(captureId: string, content: string) {
  return asUser((ctx) => updateCapture(ctx, id.parse(captureId), { content: z.string().min(1).max(20000).parse(content) }));
}

/** File a capture under a project, or clear it with null. */
export async function setCaptureProjectAction(captureId: string, projectId: string | null) {
  return asUser((ctx) => updateCapture(ctx, id.parse(captureId), { project: id.nullable().parse(projectId) }));
}

export async function searchCapturesAction(query: string, includeArchived: boolean) {
  return readAsUser((ctx) =>
    listCaptures(ctx, { query: z.string().max(200).parse(query) || undefined, includeArchived: !!includeArchived, limit: 100 }),
  );
}

export async function archiveCaptureAction(captureId: string, archived = true) {
  return asUser((ctx) => updateCapture(ctx, id.parse(captureId), { archived: !!archived }));
}

/** When a capture comes back (see scheduleSchema), or null to stop resurfacing it. */
export async function resurfaceCaptureAction(captureId: string, schedule: Schedule | null) {
  return asUser((ctx) => setResurface(ctx, id.parse(captureId), scheduleSchema.nullable().parse(schedule)));
}

/** Take a capture out of Resurfaced. */
export async function markCaptureSeenAction(captureId: string) {
  return asUser((ctx) => markCaptureSeen(ctx, id.parse(captureId)));
}

export async function deleteCaptureAction(captureId: string) {
  return asUser((ctx) => deleteCapture(ctx, id.parse(captureId)));
}

export async function convertCaptureAction(captureId: string) {
  return asUser((ctx) => convertCaptureToTask(ctx, id.parse(captureId)));
}
