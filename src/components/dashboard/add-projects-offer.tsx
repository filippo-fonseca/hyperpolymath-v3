"use client";

import { useState } from "react";
import { addProjectsWidgetAction } from "@/app/actions/projects";
import { IconPlus } from "@/components/ui/icons";
import { useDashboard } from "./context";

/**
 * Dashboards seeded before the Projects widget existed don't have it. In edit
 * mode, offer it once from the bottom bar until it's on the grid.
 */
export function AddProjectsOffer() {
  const { data, run } = useDashboard();
  const [busy, setBusy] = useState(false);
  if (data.widgets.some((w) => w.kind === "projects")) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await run(addProjectsWidgetAction(), { success: "Projects widget added" });
        setBusy(false);
      }}
      className="inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium text-accent transition hover:bg-accent-soft disabled:opacity-50"
    >
      <IconPlus size={15} strokeWidth={2.2} /> Projects
    </button>
  );
}
