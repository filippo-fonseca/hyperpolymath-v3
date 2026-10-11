"use client";

import { useEffect, useState } from "react";
import type { AreaWithProjects, ProjectWithCounts } from "@/lib/dashboard-types";
import { isLive } from "@/lib/projects";
import { pluralize } from "@/lib/format";
import {
  createAreaAction,
  createProjectAction,
  deleteAreaAction,
  reorderAreasAction,
  updateAreaAction,
} from "@/app/actions/projects";
import { Button, IconButton, Sheet, fieldClass } from "@/components/ui/primitives";
import { IconArchive, IconChevronDown, IconDots, IconPlus, IconTrash, IconUndo } from "@/components/ui/icons";
import { ConfirmCard } from "@/components/teammates/form";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { useDashboard } from "@/components/dashboard/context";
import { Emoji, EmojiButton, Layer, StatusPill } from "./project-bits";
import { ProjectCard } from "./project-card";
import { ProjectSheet } from "./project-sheet";
import { clearNewProjectRequest, peekNewProjectRequest } from "./intent";
import { useProjects } from "./use-projects";

const ALL = "all";
const NONE = "none";

/** Life areas with their projects, like v2's Areas page. */
export function ProjectsView() {
  const { all, areas, unsorted } = useProjects();
  const [filter, setFilter] = useState<string>(ALL);
  const [addingArea, setAddingArea] = useState(false);
  // "+ Project" on the widget opens this view with the new-project form up.
  const [addingTo, setAddingTo] = useState<string | null>(() => (peekNewProjectRequest() ? (areas[0]?.id ?? NONE) : null));
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => clearNewProjectRequest(), []);

  const visible = (ps: ProjectWithCounts[]) => ps.filter(isLive);
  const sections: { key: string; area: AreaWithProjects | null; projects: ProjectWithCounts[] }[] = [
    ...areas.map((a) => ({ key: a.id, area: a, projects: visible(a.projects) })),
    { key: NONE, area: null, projects: visible(unsorted) },
  ].filter((s) => s.area || s.projects.length || addingTo === NONE);
  const shown = filter === ALL ? sections : sections.filter((s) => s.key === filter);

  // The quiet section: finished projects, archived projects and archived areas.
  const finished = [...areas.flatMap((a) => a.projects), ...unsorted].filter((p) => !p.archived_at && p.status === "done");
  const archivedProjects = [...all.areas.flatMap((a) => a.projects), ...all.unsorted].filter((p) => p.archived_at);
  const archivedAreas = all.areas.filter((a) => a.archived_at);
  const activeCount = sections.reduce((n, s) => n + s.projects.filter((p) => p.status === "active").length, 0);

  const move = (id: string, dir: -1 | 1) => {
    const ids = areas.map((a) => a.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return null;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return ids;
  };

  return (
    <div>
      <ExpandedHeader
        eyebrow={`${pluralize(activeCount, "active project")} across ${pluralize(areas.length, "area")}`}
        title="Projects"
        aside={
          <div className="flex gap-2">
            <Button size="sm" variant="soft" onClick={() => setAddingTo(filter !== ALL ? filter : (areas[0]?.id ?? NONE))}>
              <IconPlus size={15} /> Project
            </Button>
            <Button size="sm" variant="soft" onClick={() => setAddingArea(true)}>
              <IconPlus size={15} /> Area
            </Button>
          </div>
        }
      />

      {addingArea && <NewAreaForm onDone={() => setAddingArea(false)} />}

      <div className="flex flex-col gap-6 sm:grid sm:grid-cols-[188px_minmax(0,1fr)] sm:gap-8">
        {/* Area list: a filter column on desktop, wrapping pills on phones */}
        <nav aria-label="Areas" className="flex flex-wrap gap-1.5 sm:sticky sm:top-0 sm:flex-col sm:flex-nowrap sm:gap-0.5 sm:self-start">
          <AreaTab active={filter === ALL} onClick={() => setFilter(ALL)} label="All areas" count={activeCount} />
          {areas.map((a) => (
            <AreaTab
              key={a.id}
              active={filter === a.id}
              onClick={() => setFilter(a.id)}
              emoji={a.emoji}
              label={a.name}
              count={a.projects.filter(isLive).length}
            />
          ))}
          {unsorted.some(isLive) && (
            <AreaTab active={filter === NONE} onClick={() => setFilter(NONE)} label="No area" count={unsorted.filter(isLive).length} />
          )}
        </nav>

        <div className="flex min-w-0 flex-col gap-8">
          {areas.length === 0 && unsorted.length === 0 && !addingArea && (
            <div className="py-10 text-center">
              <div className="text-[15px] font-medium">No areas yet</div>
              <p className="mx-auto mt-1 max-w-[320px] text-[14px] text-ink-3">
                Areas are the big buckets of your life, like School, Work or Health. Projects live inside them.
              </p>
              <Button size="sm" variant="dark" className="mt-4" onClick={() => setAddingArea(true)}>
                <IconPlus size={15} /> New area
              </Button>
            </div>
          )}
          {shown.map((s) => (
            <AreaSection
              key={s.key}
              area={s.area}
              projects={s.projects}
              adding={addingTo === s.key}
              onAdd={() => setAddingTo(s.key)}
              onAddDone={(id) => {
                setAddingTo(null);
                if (id) setProjectId(id);
              }}
              onOpen={setProjectId}
              moveUp={s.area ? move(s.area.id, -1) : null}
              moveDown={s.area ? move(s.area.id, 1) : null}
              onArchived={() => setFilter(ALL)}
            />
          ))}
          <QuietSection
            finished={finished}
            archivedProjects={archivedProjects}
            archivedAreas={archivedAreas}
            onOpen={setProjectId}
          />
        </div>
      </div>

      <ProjectSheet projectId={projectId} onClose={() => setProjectId(null)} />
    </div>
  );
}

function AreaTab({
  active,
  onClick,
  emoji,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  emoji?: string | null;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 min-w-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium transition sm:h-9 sm:rounded-[10px] sm:px-2.5 ${
        active ? "bg-gray-150 text-ink sm:bg-gray-150" : "bg-gray-100 text-ink-2 hover:bg-gray-150 sm:bg-transparent"
      }`}
    >
      {emoji !== undefined && <Emoji emoji={emoji} size={14} />}
      <span className="min-w-0 truncate">{label}</span>
      <span className="ml-auto pl-1 text-[12px] tabular-nums text-ink-3">{count}</span>
    </button>
  );
}

function AreaSection({
  area,
  projects,
  adding,
  onAdd,
  onAddDone,
  onOpen,
  moveUp,
  moveDown,
  onArchived,
}: {
  area: AreaWithProjects | null;
  projects: ProjectWithCounts[];
  adding: boolean;
  onAdd: () => void;
  onAddDone: (createdId: string | null) => void;
  onOpen: (id: string) => void;
  moveUp: string[] | null;
  moveDown: string[] | null;
  onArchived: () => void;
}) {
  const { run } = useDashboard();
  const [menu, setMenu] = useState(false);
  const sorted = [...projects].sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1));

  return (
    <section>
      <div className="mb-3 flex min-w-0 items-center gap-1">
        {area ? (
          <>
            <EmojiButton
              value={area.emoji}
              onChange={(emoji) => run(updateAreaAction(area.id, { emoji }))}
              size={20}
              className="-ml-2"
              label={`Emoji for ${area.name}`}
            />
            <AreaName area={area} />
          </>
        ) : (
          <h3 className="min-w-0 flex-1 truncate text-[19px] font-semibold tracking-[-0.015em] text-ink-2">No area</h3>
        )}
        <span className="shrink-0 px-1 text-[13px] tabular-nums text-ink-3">{projects.length}</span>
        <IconButton label="New project" className="h-8 w-8" onClick={onAdd}>
          <IconPlus size={16} />
        </IconButton>
        {area && (
          <IconButton label={`${area.name} options`} className="h-8 w-8" onClick={() => setMenu(true)}>
            <IconDots size={17} />
          </IconButton>
        )}
      </div>

      {adding && <NewProjectForm areaId={area?.id ?? null} onDone={onAddDone} />}

      {sorted.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sorted.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />
          ))}
        </div>
      ) : (
        !adding && (
          <button
            type="button"
            onClick={onAdd}
            className="w-full rounded-[18px] border-[1.5px] border-dashed border-gray-250 px-4 py-5 text-[13.5px] text-ink-3 transition hover:border-gray-300 hover:text-ink-2"
          >
            No projects here yet. Add one.
          </button>
        )
      )}

      {area && (
        <AreaMenu
          area={area}
          open={menu}
          onClose={() => setMenu(false)}
          moveUp={moveUp}
          moveDown={moveDown}
          onArchived={onArchived}
        />
      )}
    </section>
  );
}

/** Area heading that renames in place. */
function AreaName({ area }: { area: AreaWithProjects }) {
  const { run } = useDashboard();
  const [v, setV] = useState(area.name);
  const [prev, setPrev] = useState(area.name);
  if (prev !== area.name) {
    setPrev(area.name);
    setV(area.name);
  }
  const commit = () => {
    const next = v.trim();
    if (!next) setV(area.name);
    else if (next !== area.name) void run(updateAreaAction(area.id, { name: next }));
  };
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(area.name);
      }}
      aria-label="Area name"
      maxLength={120}
      className="-mx-1 min-w-0 flex-1 truncate rounded-[8px] bg-transparent px-1 py-0.5 text-[19px] font-semibold tracking-[-0.015em] outline-none transition hover:bg-gray-100 focus:bg-gray-100"
    />
  );
}

function AreaMenu({
  area,
  open,
  onClose,
  moveUp,
  moveDown,
  onArchived,
}: {
  area: AreaWithProjects;
  open: boolean;
  onClose: () => void;
  moveUp: string[] | null;
  moveDown: string[] | null;
  onArchived: () => void;
}) {
  const { run } = useDashboard();
  const [confirm, setConfirm] = useState(false);
  const close = () => {
    setConfirm(false);
    onClose();
  };
  const reorder = async (ids: string[] | null) => {
    if (!ids) return;
    close();
    await run(reorderAreasAction(ids));
  };
  const row = "flex h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[14.5px] transition hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <Layer>
      <Sheet
        open={open}
        onClose={close}
        width={380}
        title={
          <span className="flex items-center gap-2">
            <Emoji emoji={area.emoji} size={17} /> {area.name}
          </span>
        }
      >
        {confirm ? (
          <ConfirmCard
            text={`Delete “${area.name}”? Its projects stay and move to No area. You can revert this from Activity.`}
            action="Delete area"
            onCancel={() => setConfirm(false)}
            onConfirm={async () => {
              close();
              await run(deleteAreaAction(area.id), { success: `Deleted “${area.name}”` });
              onArchived();
            }}
          />
        ) : (
          <div className="flex flex-col pb-1">
            <button type="button" className={row} disabled={!moveUp} onClick={() => reorder(moveUp)}>
              <IconChevronDown size={17} className="rotate-180 text-gray-500" /> Move up
            </button>
            <button type="button" className={row} disabled={!moveDown} onClick={() => reorder(moveDown)}>
              <IconChevronDown size={17} className="text-gray-500" /> Move down
            </button>
            <button
              type="button"
              className={row}
              onClick={async () => {
                close();
                const res = await run(updateAreaAction(area.id, { archived: true }), { success: `Archived “${area.name}”` });
                if (res) onArchived();
              }}
            >
              <IconArchive size={17} className="text-gray-500" /> Archive area
            </button>
            <button type="button" className={`${row} text-[#d61a2f]`} onClick={() => setConfirm(true)}>
              <IconTrash size={17} /> Delete area
            </button>
          </div>
        )}
      </Sheet>
    </Layer>
  );
}

function NewAreaForm({ onDone }: { onDone: () => void }) {
  const { run } = useDashboard();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await run(createAreaAction({ name: name.trim(), emoji }), { success: "Area added" });
    setBusy(false);
    if (res) onDone();
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="mb-6 flex flex-wrap items-center gap-2 rounded-[18px] bg-gray-50 p-3 shadow-ring"
    >
      <EmojiButton value={emoji} onChange={setEmoji} size={20} label="Area emoji" />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Area name, e.g. School"
        maxLength={120}
        aria-label="Area name"
        className={`${fieldClass} min-w-0 flex-1`}
      />
      <div className="flex gap-2 max-sm:w-full max-sm:justify-end">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" variant="dark" type="submit" disabled={busy || !name.trim()}>
          Add area
        </Button>
      </div>
    </form>
  );
}

function NewProjectForm({ areaId, onDone }: { areaId: string | null; onDone: (createdId: string | null) => void }) {
  const { run } = useDashboard();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await run(createProjectAction({ name: name.trim(), emoji, area: areaId }));
    setBusy(false);
    if (res) onDone(res.id);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="mb-3 flex flex-wrap items-center gap-2 rounded-[18px] bg-gray-50 p-3 shadow-ring"
    >
      <EmojiButton value={emoji} onChange={setEmoji} size={20} label="Project emoji" />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        maxLength={200}
        aria-label="Project name"
        className={`${fieldClass} min-w-0 flex-1`}
      />
      <div className="flex gap-2 max-sm:w-full max-sm:justify-end">
        <Button size="sm" variant="ghost" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button size="sm" variant="dark" type="submit" disabled={busy || !name.trim()}>
          Add project
        </Button>
      </div>
    </form>
  );
}

/** Done projects, archived projects and archived areas, collapsed by default. */
function QuietSection({
  finished,
  archivedProjects,
  archivedAreas,
  onOpen,
}: {
  finished: ProjectWithCounts[];
  archivedProjects: ProjectWithCounts[];
  archivedAreas: AreaWithProjects[];
  onOpen: (id: string) => void;
}) {
  const { run } = useDashboard();
  const [open, setOpen] = useState(false);
  const count = finished.length + archivedProjects.length + archivedAreas.length;
  if (!count) return null;
  return (
    <section className="border-t border-gray-150 pt-5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-[13px] font-semibold">
        <span className="text-gray-500">Done and archived</span>
        <span className="font-medium tabular-nums text-ink-3">{count}</span>
        <IconChevronDown size={14} className={`text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-gray-150">
          {[...finished, ...archivedProjects].map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                className="flex min-h-11 w-full min-w-0 items-center gap-2.5 py-1.5 text-left text-ink-2 transition hover:text-ink"
              >
                <Emoji emoji={p.emoji} size={15} />
                <span className="min-w-0 flex-1 truncate text-[14.5px]">{p.name}</span>
                {p.archived_at ? (
                  <span className="shrink-0 text-[12px] text-ink-3">Archived</span>
                ) : (
                  <StatusPill status={p.status} />
                )}
              </button>
            </li>
          ))}
          {archivedAreas.map((a) => (
            <li key={a.id} className="flex min-h-11 min-w-0 items-center gap-2.5 py-1.5 text-ink-2">
              <Emoji emoji={a.emoji} size={15} />
              <span className="min-w-0 flex-1 truncate text-[14.5px]">
                {a.name} <span className="text-[12.5px] text-ink-3">· area, {pluralize(a.projects.length, "project")}</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => run(updateAreaAction(a.id, { archived: false }), { success: `Restored “${a.name}”` })}>
                <IconUndo size={14} /> Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
