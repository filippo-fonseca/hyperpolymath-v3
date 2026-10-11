"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import type { Capture, ProjectStatus, Task } from "@/lib/dashboard-types";
import { STATUSES, STATUS_LABELS, asStatus, progressOf, type ProjectEntry } from "@/lib/projects";
import { relativeTime } from "@/lib/format";
import { deleteProjectAction, getProjectAction, updateProjectAction } from "@/app/actions/projects";
import { createCaptureAction } from "@/app/actions/captures";
import { Button, Segmented, Sheet, Switch, fieldClass } from "@/components/ui/primitives";
import { IconArchive, IconChevronDown, IconTrash, IconUndo } from "@/components/ui/icons";
import { ConfirmCard, selectClass, selectStyle } from "@/components/teammates/form";
import { useDashboard } from "@/components/dashboard/context";
import { QuickAdd } from "../tasks/task-bits";
import { ListRow } from "../tasks/tasks-view";
import { sortToday, useTasks } from "../tasks/use-tasks";
import { EmojiButton, Layer, ProgressBar } from "./project-bits";
import { useProjects } from "./use-projects";

/** The project page: a sheet over the Projects view. Closes itself if the project goes away. */
export function ProjectSheet({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const { index } = useProjects();
  const entry = projectId ? index.get(projectId) : undefined;
  return (
    <Layer>
      <Sheet
        open={!!entry}
        onClose={onClose}
        width={640}
        title={
          entry ? (
            <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-medium text-gray-500">
              {entry.area?.emoji && <span>{entry.area.emoji}</span>}
              {entry.area ? entry.area.name : "No area"}
            </span>
          ) : (
            ""
          )
        }
      >
        {entry && <ProjectPage key={entry.project.id} entry={entry} onClose={onClose} />}
      </Sheet>
    </Layer>
  );
}

type Detail = { tasks: Task[]; captures: Capture[] };

function ProjectPage({ entry, onClose }: { entry: ProjectEntry; onClose: () => void }) {
  const { data, run, nowMs } = useDashboard();
  const { areas } = useProjects();
  const ops = useTasks();
  const p = entry.project;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Done tasks and captures aren't all in the dashboard data, so fetch them,
  // again whenever a refresh brings new tasks or captures.
  useEffect(() => {
    let live = true;
    void run(getProjectAction(p.id), { quiet: true }).then((res) => {
      if (live && res) setDetail({ tasks: res.tasks, captures: res.captures });
    });
    return () => {
      live = false;
    };
  }, [p.id, run, data.openTasks, data.doneTasks, data.captures]);

  const save = (patch: Parameters<typeof updateProjectAction>[1]) => run(updateProjectAction(p.id, patch));

  const open = sortToday(ops.open.filter((t) => t.project_id === p.id));
  const openIds = new Set(open.map((t) => t.id));
  const done = (detail?.tasks ?? [])
    .filter((t) => t.status === "done" && !openIds.has(t.id) && !ops.isHidden(t))
    .map(ops.apply)
    .filter((t) => t.project_id === p.id);
  const captures = detail?.captures ?? data.captures.filter((c) => c.project_id === p.id);

  return (
    <div className="flex flex-col gap-6 pb-2">
      {/* Header */}
      <div>
        <div className="flex min-w-0 items-center gap-1.5">
          <EmojiButton value={p.emoji} onChange={(emoji) => save({ emoji })} size={30} className="-ml-1.5" label="Project emoji" />
          <InlineText
            value={p.name}
            onCommit={(name) => name && save({ name })}
            ariaLabel="Project name"
            className="text-[24px] font-bold tracking-[-0.02em]"
            required
          />
        </div>
        {p.archived_at && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gray-150 px-2.5 py-1 text-[12.5px] font-medium text-gray-600">
            <IconArchive size={13} /> Archived
          </div>
        )}
      </div>

      {/* Properties, Notion-style label and value rows */}
      <div className="flex flex-col gap-1">
        <Prop label="Status">
          <Segmented<ProjectStatus>
            size="sm"
            value={asStatus(p.status)}
            onChange={(status) => save({ status })}
            options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        </Prop>
        <Prop label="Area">
          <select
            aria-label="Area"
            value={p.area_id && areas.some((a) => a.id === p.area_id) ? p.area_id : ""}
            onChange={(e) => save({ area: e.target.value || null })}
            className={`${selectClass} h-9 w-full max-w-[260px]`}
            style={selectStyle}
          >
            <option value="">No area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emoji ? `${a.emoji} ` : ""}
                {a.name}
              </option>
            ))}
          </select>
        </Prop>
        <Prop label="Dates">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Start date"
              value={p.start_date ?? ""}
              onChange={(e) => save({ start_date: e.target.value || null })}
              className={`${fieldClass} h-9 w-[150px] max-sm:min-w-0 max-sm:flex-1`}
            />
            <span className="text-[13px] text-ink-3">to</span>
            <input
              type="date"
              aria-label="End date"
              value={p.end_date ?? ""}
              onChange={(e) => save({ end_date: e.target.value || null })}
              className={`${fieldClass} h-9 w-[150px] max-sm:min-w-0 max-sm:flex-1`}
            />
          </div>
        </Prop>
        <Prop label="Class">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Switch checked={p.is_class} onChange={(is_class) => save({ is_class })} label="This project is a class" />
            {p.is_class && (
              <>
                <InlineField value={p.course_code ?? ""} placeholder="Course code" onCommit={(v) => save({ course_code: v || null })} className="w-[120px]" />
                <InlineField value={p.term ?? ""} placeholder="Term" onCommit={(v) => save({ term: v || null })} className="w-[130px]" />
              </>
            )}
          </div>
        </Prop>
      </div>

      <InlineText
        value={p.description ?? ""}
        onCommit={(description) => save({ description: description || null })}
        ariaLabel="Description"
        placeholder="Add a description"
        multiline
        className="text-[15px] leading-relaxed text-ink-2"
      />

      {/* Tasks */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-gray-500">
            Tasks <span className="font-medium tabular-nums text-ink-3">{open.length}</span>
          </h3>
          {p.open_tasks + p.done_tasks > 0 && (
            <div className="flex w-[140px] items-center gap-2">
              <ProgressBar value={progressOf(p)} className="flex-1" />
              <span className="text-[12px] tabular-nums text-gray-500">{Math.round(progressOf(p) * 100)}%</span>
            </div>
          )}
        </div>
        <QuickAdd placeholder={`Add a task to ${p.name}`} onSubmit={(title) => ops.create({ title, project: p.id })} />
        {open.length > 0 ? (
          <ul className="mt-2 divide-y divide-gray-150">
            <AnimatePresence initial={false}>
              {open.map((t) => (
                <ListRow
                  key={t.id}
                  task={t}
                  ops={ops}
                  hideProject
                  expanded={openId === t.id}
                  onToggleOpen={() => setOpenId((id) => (id === t.id ? null : t.id))}
                />
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="py-5 text-center text-[13.5px] text-ink-3">No open tasks.</div>
        )}
        {done.length > 0 && (
          <div className="mt-2">
            <button type="button" onClick={() => setShowDone((v) => !v)} className="flex items-center gap-2 py-1 text-[13px] font-semibold">
              <span className="text-gray-500">Done</span>
              <span className="font-medium tabular-nums text-ink-3">{done.length}</span>
              <IconChevronDown size={14} className={`text-ink-3 transition-transform ${showDone ? "rotate-180" : ""}`} />
            </button>
            {showDone && (
              <ul className="divide-y divide-gray-150">
                {done.map((t) => (
                  <ListRow
                    key={t.id}
                    task={t}
                    ops={ops}
                    hideProject
                    expanded={openId === t.id}
                    onToggleOpen={() => setOpenId((id) => (id === t.id ? null : t.id))}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Captures */}
      <section>
        <h3 className="mb-2 text-[13px] font-semibold text-gray-500">
          Captures <span className="font-medium tabular-nums text-ink-3">{captures.length}</span>
        </h3>
        <QuickAdd
          placeholder="Jot something down for this project"
          onSubmit={(content) => run(createCaptureAction(content, null, p.id), { success: "Captured" })}
        />
        {captures.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-150">
            {captures.map((c) => (
              <li key={c.id} className="py-2.5">
                <p className={`line-clamp-4 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed ${c.archived_at ? "text-ink-3" : ""}`}>
                  {c.content}
                </p>
                <div className="mt-0.5 text-[12.5px] text-gray-500">
                  {c.source !== "you" ? `${c.source} · ` : ""}
                  {relativeTime(c.created_at, nowMs)}
                  {c.archived_at ? " · archived" : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Archive and delete */}
      <div className="flex flex-col gap-3 border-t border-gray-150 pt-4">
        {confirmDelete ? (
          <ConfirmCard
            text={`Delete “${p.name}”? Its tasks and captures stay, just without a project. You can revert this from Activity.`}
            action="Delete project"
            onCancel={() => setConfirmDelete(false)}
            onConfirm={async () => {
              const res = await run(deleteProjectAction(p.id), { success: `Deleted “${p.name}”` });
              if (res) onClose();
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {p.archived_at ? (
              <Button size="sm" variant="soft" onClick={() => save({ archived: false })}>
                <IconUndo size={15} /> Restore
              </Button>
            ) : (
              <Button
                size="sm"
                variant="soft"
                onClick={async () => {
                  const res = await run(updateProjectAction(p.id, { archived: true }), { success: `Archived “${p.name}”` });
                  if (res) onClose();
                }}
              >
                <IconArchive size={15} /> Archive
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
              <IconTrash size={15} /> Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-10 min-w-0 items-center gap-3">
      <div className="w-[64px] shrink-0 text-[13px] text-gray-500 sm:w-[84px]">{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Text that edits in place: looks like plain text until focused (Notion style). */
function InlineText({
  value,
  onCommit,
  ariaLabel,
  placeholder,
  className = "",
  multiline = false,
  required = false,
}: {
  value: string;
  onCommit: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  required?: boolean;
}) {
  const [v, setV] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setV(value);
  }
  const commit = () => {
    const next = multiline ? v.replace(/\s+$/, "") : v.trim();
    if (required && !next) setV(value);
    else if (next !== value) onCommit(next);
  };
  const cls = `w-full min-w-0 rounded-[8px] bg-transparent px-1.5 py-1 -mx-1.5 outline-none transition placeholder:text-ink-3 hover:bg-gray-100 focus:bg-gray-100 ${className}`;
  if (multiline) {
    return (
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        aria-label={ariaLabel}
        placeholder={placeholder}
        rows={Math.min(12, Math.max(1, v.split("\n").length))}
        className={`resize-none ${cls}`}
      />
    );
  }
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={200}
      className={`truncate ${cls}`}
    />
  );
}

/** A small field that saves on blur or Enter. */
function InlineField({
  value,
  placeholder,
  onCommit,
  className = "",
}: {
  value: string;
  placeholder: string;
  onCommit: (v: string) => void;
  className?: string;
}) {
  const [v, setV] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setV(value);
  }
  return (
    <input
      value={v}
      placeholder={placeholder}
      aria-label={placeholder}
      maxLength={60}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== value && onCommit(v.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`${fieldClass} h-9 max-sm:min-w-0 max-sm:flex-1 ${className}`}
    />
  );
}
