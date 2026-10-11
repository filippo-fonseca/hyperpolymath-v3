"use client";

import type { ProjectStatus, ProjectWithCounts } from "@/lib/dashboard-types";
import { classLabel, dateRangeLabel, progressOf } from "@/lib/projects";
import { updateProjectAction } from "@/app/actions/projects";
import { useDashboard } from "@/components/dashboard/context";
import { Emoji, ProgressBar, StatusPill } from "./project-bits";

/** A project at a glance: emoji, name, status, class badge, dates and task progress. */
export function ProjectCard({ project, onOpen }: { project: ProjectWithCounts; onOpen: () => void }) {
  const { run } = useDashboard();
  const cls = classLabel(project);
  const dates = dateRangeLabel(project);
  const total = project.open_tasks + project.done_tasks;
  const setStatus = (status: ProjectStatus) => run(updateProjectAction(project.id, { status }));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`flex min-w-0 cursor-pointer flex-col gap-2.5 rounded-[18px] bg-white p-4 shadow-ring transition-shadow duration-200 hover:shadow-pop ${
        project.status === "paused" ? "opacity-70" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Emoji emoji={project.emoji} size={20} />
        <div className="min-w-0 flex-1 truncate text-[15.5px] font-semibold tracking-[-0.01em]">{project.name}</div>
        <StatusPill status={project.status} onChange={setStatus} />
      </div>
      {(cls || dates) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {cls && (
            <span className="max-w-full truncate rounded-full bg-gray-150 px-2 py-0.5 text-[11.5px] font-semibold text-gray-700">{cls}</span>
          )}
          {dates && <span className="text-[12.5px] text-gray-500">{dates}</span>}
        </div>
      )}
      <div className="mt-auto flex items-center gap-3">
        <ProgressBar value={progressOf(project)} className="flex-1" />
        <span className="shrink-0 text-[12.5px] tabular-nums text-gray-500">
          {total ? `${project.open_tasks} open · ${project.done_tasks} done` : "No tasks yet"}
        </span>
      </div>
    </div>
  );
}
