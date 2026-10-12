"use server";

import { exportAll, setupStatus, type SetupStatus } from "@/server/status";
import { currentEmail } from "@/lib/session";
import { version } from "../../../package.json";
import { readAsUser } from "./run";

export type SettingsOverview = { status: SetupStatus; email: string | null; version: string };

/** Setup checklist, delivery health and counts for the Settings sheet. */
export async function settingsOverviewAction() {
  return readAsUser(async (ctx): Promise<SettingsOverview> => ({
    status: await setupStatus(ctx),
    email: await currentEmail(),
    version,
  }));
}

/** Everything the owner has, as JSON, for "Export everything". */
export async function exportAllAction() {
  return readAsUser((ctx) => exportAll(ctx));
}
