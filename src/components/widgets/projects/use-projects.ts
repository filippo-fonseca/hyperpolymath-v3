"use client";

import { useMemo } from "react";
import { indexProjects, liveAreas } from "@/lib/projects";
import { useDashboard } from "@/components/dashboard/context";

/** Areas and projects from the dashboard data, with a by-id index. */
export function useProjects() {
  const { data } = useDashboard();
  return useMemo(() => {
    const all = data.areas;
    return {
      all,
      /** Non-archived areas with their non-archived projects. */
      areas: liveAreas(all),
      /** Non-archived projects with no area. */
      unsorted: all.unsorted.filter((p) => !p.archived_at),
      /** Every project (archived too) by id, for chips and lookups. */
      index: indexProjects(all),
    };
  }, [data.areas]);
}
