"use client";

import type { ProjectWithCounts } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { progressOf } from "@/lib/projects";
import { useFitCount, useMediaQuery } from "@/components/ui/primitives";
import { IconPlus } from "@/components/ui/icons";
import { KiwiBuilding } from "@/components/illustrations";
import { useDashboard } from "@/components/dashboard/context";
import { HeaderAction, WidgetHeader } from "@/components/dashboard/widget-chrome";
import { Ring } from "../habits/ring";
import { Emoji } from "./project-bits";
import { requestNewProject } from "./intent";
import { useProjects } from "./use-projects";

const ROW_H = 28;

type Row =
  | { kind: "area"; key: string; emoji: string | null; name: string }
  | { kind: "project"; key: string; project: ProjectWithCounts };

/** Areas with their active projects (L and W add paused ones, dimmed; W puts areas side by side). */
export function ProjectsWidget({ size, widgetId }: { size: WidgetSize; widgetId: string }) {
  const { open } = useDashboard();
  const { areas, unsorted } = useProjects();
  const [listRef, fit] = useFitCount<HTMLDivElement>(ROW_H, size === "l" ? 10 : 4);
  const showPaused = size === "l" || size === "w";
  // Wide shows one row of area columns: four on desktop, two below.
  const areaCols = useMediaQuery("(min-width: 1024px)") ? 4 : 2;
  const pick = (ps: ProjectWithCounts[]) =>
    ps.filter((p) => p.status === "active" || (showPaused && p.status === "paused")).sort((a, b) => rank(a) - rank(b));
  const groups = [
    ...areas.map((a) => ({ key: a.id, emoji: a.emoji, name: a.name, projects: pick(a.projects) })),
    { key: "none", emoji: null, name: "No area", projects: pick(unsorted) },
  ].filter((g) => g.projects.length);
  const active = [...areas.flatMap((a) => a.projects), ...unsorted].filter((p) => p.status === "active");
  const addAction = (
    <HeaderAction
      label="New project"
      onClick={() => {
        requestNewProject();
        open(widgetId);
      }}
    >
      <IconPlus size={16} strokeWidth={2} />
    </HeaderAction>
  );
  const emptyState = (
    <div className={`flex h-full items-center justify-center ${size === "m" ? "gap-3" : "flex-col gap-1 text-center"}`}>
      <KiwiBuilding size={size === "m" ? 80 : 132} className="shrink-0" />
      <div>
        <div className="text-[15px] font-medium">No active projects</div>
        <div className="mt-0.5 text-[13px] text-ink-3">Group your work into areas like School or Health.</div>
      </div>
    </div>
  );

  if (size === "s") {
    const top = [...areas]
      .map((a) => ({ a, n: a.projects.filter((p) => p.status === "active").length }))
      .sort((x, y) => y.n - x.n)[0];
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader />
        <div className="mt-1 text-[34px] font-light leading-none tracking-[-0.02em] tabular-nums">{active.length}</div>
        <div className="mt-auto min-w-0">
          {top && top.n > 0 ? (
            <>
              <div className="flex min-w-0 items-center gap-1.5 text-[14px] font-medium leading-snug">
                <Emoji emoji={top.a.emoji} size={14} />
                <span className="truncate">{top.a.name}</span>
              </div>
              <div className="text-[12px] text-ink-3">{top.n} active</div>
            </>
          ) : (
            <div className="text-[14px] text-ink-3">{active.length ? "Active projects" : "No projects yet"}</div>
          )}
        </div>
      </div>
    );
  }

  if (size === "w") {
    return (
      <div className="flex h-full flex-col">
        <WidgetHeader
          meta={groups.length > areaCols ? `${active.length} active · ${groups.length - areaCols} more areas` : `${active.length} active`}
          actions={addAction}
        />
        {groups.length === 0 ? (
          emptyState
        ) : (
          <div ref={listRef} className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
            {groups.slice(0, areaCols).map((g) => {
              const room = Math.max(1, fit - 1);
              const shown = g.projects.length > room ? g.projects.slice(0, room - 1) : g.projects;
              return (
                <section key={g.key} className="flex min-h-0 min-w-0 flex-col rounded-[14px] bg-gray-50 p-2.5 shadow-[inset_0_0_0_1px_rgb(20_20_20/0.04)]">
                  <h3 className="flex h-6 shrink-0 items-center gap-1.5 text-[12px] font-semibold text-gray-500">
                    {g.emoji && <span className="text-[12px] leading-none">{g.emoji}</span>}
                    <span className="truncate">{g.name}</span>
                    <span className="ml-auto font-medium tabular-nums text-ink-3">{g.projects.length}</span>
                  </h3>
                  <ul className="mt-1 min-h-0 flex-1 overflow-hidden">
                    {shown.map((p) => (
                      <ProjectRow key={p.id} p={p} />
                    ))}
                    {g.projects.length > shown.length && (
                      <li className="flex h-7 items-center text-[12.5px] text-gray-500">{g.projects.length - shown.length} more</li>
                    )}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const rows: Row[] = groups.flatMap((g) => [
    { kind: "area" as const, key: `a:${g.key}`, emoji: g.emoji, name: g.name },
    ...g.projects.map((p) => ({ kind: "project" as const, key: p.id, project: p })),
  ]);
  const totalProjects = rows.filter((r) => r.kind === "project").length;
  // Keep a line for "N more" when everything doesn't fit, and never end on a bare area label.
  let shown = rows.length > fit ? rows.slice(0, Math.max(1, fit - 1)) : rows;
  while (shown.length && shown[shown.length - 1].kind === "area") shown = shown.slice(0, -1);
  const more = totalProjects - shown.filter((r) => r.kind === "project").length;

  return (
    <div className="flex h-full flex-col">
      <WidgetHeader meta={`${active.length} active`} actions={addAction} />
      <div ref={listRef} className="mt-1.5 min-h-0 flex-1 overflow-hidden">
        {rows.length === 0 ? (
          emptyState
        ) : (
          <ul className="flex flex-col">
            {shown.map((r) =>
              r.kind === "area" ? (
                <li key={r.key} className="flex h-7 items-end gap-1.5 pb-1 text-[12px] font-semibold text-gray-500">
                  {r.emoji && <span className="text-[12px] leading-none">{r.emoji}</span>}
                  <span className="truncate">{r.name}</span>
                </li>
              ) : (
                <ProjectRow key={r.key} p={r.project} />
              ),
            )}
            {more > 0 && <li className="flex h-7 items-center text-[13px] text-gray-500">{more} more</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

const rank = (p: ProjectWithCounts) => (p.status === "active" ? 0 : 1);

function ProjectRow({ p }: { p: ProjectWithCounts }) {
  const paused = p.status === "paused";
  return (
    <li className={`flex h-7 min-w-0 items-center gap-2.5 ${paused ? "opacity-50" : ""}`}>
      <Ring size={16} stroke={2.5} value={progressOf(p)} muted={paused} />
      <Emoji emoji={p.emoji} size={14} />
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{p.name}</span>
      <span className="shrink-0 text-[12.5px] tabular-nums text-gray-500">
        {paused ? "Paused" : p.open_tasks ? `${p.open_tasks} open` : p.done_tasks ? `${p.done_tasks} done` : "No tasks"}
      </span>
    </li>
  );
}
