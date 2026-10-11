"use server";

import { z } from "zod";
import {
  createArea,
  createProject,
  deleteArea,
  deleteProject,
  getProject,
  listAreas,
  updateArea,
  updateProject,
  type ProjectInput,
} from "@/server/projects";
import { asUser, readAsUser } from "./run";

const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const emoji = z.string().trim().max(16).nullable();

const areaPatch = z
  .object({
    name: z.string().trim().min(1).max(120),
    emoji,
    color: z.string().max(32).nullable(),
    position: z.number().finite(),
    archived: z.boolean(),
  })
  .partial();

const projectInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    area: id.nullable(),
    description: z.string().max(20000).nullable(),
    emoji,
    status: z.enum(["active", "paused", "done"]),
    start_date: date.nullable(),
    end_date: date.nullable(),
    is_class: z.boolean(),
    course_code: z.string().trim().max(40).nullable(),
    term: z.string().trim().max(60).nullable(),
    position: z.number().finite(),
  })
  .partial();

export async function listAreasAction(includeArchived = true) {
  return readAsUser((ctx) => listAreas(ctx, { includeArchived: !!includeArchived }));
}

export async function createAreaAction(input: { name: string; emoji?: string | null }) {
  return asUser((ctx) =>
    createArea(ctx, { name: z.string().trim().min(1).max(120).parse(input.name), emoji: emoji.optional().parse(input.emoji) }),
  );
}

export async function updateAreaAction(
  areaId: string,
  patch: { name?: string; emoji?: string | null; color?: string | null; position?: number; archived?: boolean },
) {
  return asUser((ctx) => updateArea(ctx, id.parse(areaId), areaPatch.parse(patch)));
}

/** Persist a new area order: each area's position becomes its index. */
export async function reorderAreasAction(areaIds: string[]) {
  return asUser(async (ctx) => {
    const ids = z.array(id).max(200).parse(areaIds);
    const { areas } = await listAreas(ctx, { includeArchived: true });
    const current = new Map(areas.map((a) => [a.id, a.position]));
    for (const [i, aid] of ids.entries()) {
      if (current.has(aid) && current.get(aid) !== i) await updateArea(ctx, aid, { position: i });
    }
    return true;
  });
}

export async function deleteAreaAction(areaId: string) {
  return asUser((ctx) => deleteArea(ctx, id.parse(areaId)));
}

export async function createProjectAction(input: ProjectInput & { name: string }) {
  return asUser((ctx) => {
    const p = projectInput.parse(input);
    return createProject(ctx, { ...p, name: z.string().trim().min(1).max(200).parse(input.name) });
  });
}

export async function updateProjectAction(projectId: string, input: ProjectInput & { archived?: boolean }) {
  return asUser((ctx) =>
    updateProject(ctx, id.parse(projectId), projectInput.extend({ archived: z.boolean().optional() }).parse(input)),
  );
}

export async function deleteProjectAction(projectId: string) {
  return asUser((ctx) => deleteProject(ctx, id.parse(projectId)));
}

/** A project with its tasks (open and done) and captures, for the project page. */
export async function getProjectAction(projectId: string) {
  return readAsUser((ctx) => getProject(ctx, id.parse(projectId)));
}
