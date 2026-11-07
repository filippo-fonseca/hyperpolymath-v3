"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Bot, Capture } from "@/lib/dashboard-types";
import { relativeTime } from "@/lib/format";
import { safeHref } from "@/lib/markdown";
import { resurfaceBadge } from "@/lib/resurface-choice";
import {
  archiveCaptureAction,
  convertCaptureAction,
  deleteCaptureAction,
  editCaptureAction,
  markCaptureSeenAction,
  resurfaceCaptureAction,
  setCaptureProjectAction,
} from "@/app/actions/captures";
import { Button } from "@/components/ui/primitives";
import { Menu } from "@/components/ui/menu";
import { BotAvatar, ProfileAvatar } from "@/components/ui/bot-avatar";
import {
  IconArchive,
  IconCheck,
  IconCheckCircle,
  IconDots,
  IconFolder,
  IconPencil,
  IconReply,
  IconResurface,
  IconTrash,
  IconUndo,
} from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";
import { ProjectChip, ProjectPicker } from "../projects/project-bits";
import { ResurfacePicker } from "./resurface-picker";
import { CaptureThread } from "./capture-thread";

/** Who posted a capture: you (typed in the app or sent from a shortcut), or a bot by name. */
export function captureAuthor(c: Capture, bots: Bot[]) {
  const source = c.source?.trim() ?? "";
  const bot = source ? bots.find((b) => b.name.toLowerCase() === source.toLowerCase()) : undefined;
  if (bot) return { bot, via: null };
  const via = source && source !== "you" && source !== "app" ? source : null;
  return { bot: null, via };
}

/**
 * One capture in the feed, like a post you wrote to yourself: avatar, name,
 * time and project, the text with its links, then replies, bring it back,
 * make it a task, and more.
 */
export function CapturePost({
  c,
  resurfaced = false,
  onHide,
  onUnhide,
}: {
  c: Capture;
  /** Shown in the Resurfaced section, with a Seen button. */
  resurfaced?: boolean;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
}) {
  const { data, nowMs, run } = useDashboard();
  const [threadOpen, setThreadOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [picking, setPicking] = useState(false);
  const [resurfaceAt, setResurfaceAt] = useState<DOMRect | null>(null);
  const [resurfaceOpen, setResurfaceOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.content);
  // Optimistic project until the refresh lands (undefined = use the server's).
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined);
  const project = projectId === undefined ? c.project_id : projectId;

  const { bot, via } = captureAuthor(c, data.bots);
  const name = bot ? bot.name : data.profile.display_name?.trim() || "You";
  const badge = resurfaceBadge(c, data.tz, data.today);
  const links = c.urls.filter((u) => safeHref(u)).slice(0, 3);

  const act = async (p: () => Promise<unknown>, hide: boolean) => {
    if (hide) onHide(c.id);
    const ok = await p();
    if (!ok && hide) onUnhide(c.id);
  };
  const fileUnder = async (id: string | null) => {
    setProjectId(id);
    await run(setCaptureProjectAction(c.id, id));
    setProjectId(undefined);
  };
  const saveEdit = async () => {
    const text = draft.trim();
    if (!text || text === c.content) return setEditing(false);
    if (await run(editCaptureAction(c.id, text), { success: "Saved" })) setEditing(false);
  };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      className={`group flex gap-3 py-4 ${
        resurfaced
          ? "rounded-[18px] bg-accent-soft/60 px-3.5 shadow-[inset_0_0_0_1px_rgb(16_132_254/0.12)]"
          : "border-b border-gray-150 px-1 last:border-b-0"
      }`}
    >
      {bot ? <BotAvatar bot={bot} size={40} /> : <ProfileAvatar profile={data.profile} size={40} />}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px]">
          <span className="truncate font-semibold">{name}</span>
          {via && <span className="shrink-0 text-gray-500">via {via}</span>}
          <span className="shrink-0 text-gray-400" aria-hidden>
            ·
          </span>
          <time dateTime={c.created_at} className="shrink-0 text-gray-500">
            {relativeTime(c.created_at, nowMs)}
          </time>
          {c.archived_at && <span className="shrink-0 text-gray-500">· archived</span>}
          {c.converted_task_id && <span className="shrink-0 text-gray-500">· became a task</span>}
          {project && (
            <button type="button" onClick={() => setPicking(true)} aria-label="Change project" className="min-w-0 max-w-full">
              <ProjectChip projectId={project} />
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-1.5">
            <textarea
              value={draft}
              autoFocus
              rows={3}
              maxLength={20000}
              aria-label="Edit capture"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void saveEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              className="block w-full resize-y rounded-[12px] bg-gray-100 px-3 py-2 text-[15px] leading-relaxed outline-none focus:bg-white focus:shadow-ring"
            />
            <div className="mt-1.5 flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="dark" onClick={saveEdit} disabled={!draft.trim()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className={`mt-1 whitespace-pre-wrap break-words text-[15.5px] leading-relaxed ${c.archived_at ? "text-ink-3" : ""}`}>
            {c.content}
          </p>
        )}

        {links.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {links.map((u) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="max-w-full truncate text-[13.5px] text-accent hover:underline">
                {u.replace(/^https?:\/\//, "")}
              </a>
            ))}
          </div>
        )}

        {badge && !resurfaced && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[12.5px] font-medium text-accent">
            <IconResurface size={13} />
            {badge}
          </div>
        )}

        <div className="-ml-2 mt-1.5 flex items-center gap-0.5 text-gray-600">
          <ActionButton
            label={threadOpen ? "Hide replies" : c.comment_count ? `${c.comment_count} replies` : "Reply"}
            active={threadOpen}
            onClick={() => setThreadOpen((v) => !v)}
          >
            <IconReply size={17} />
            {c.comment_count > 0 && <span className="tabular-nums">{c.comment_count}</span>}
          </ActionButton>
          <ActionButton
            label={badge ? "Change when it comes back" : "Bring it back later"}
            active={!!badge}
            onClick={(e) => {
              setResurfaceAt(e.currentTarget.getBoundingClientRect());
              setResurfaceOpen(true);
            }}
          >
            <IconResurface size={17} />
          </ActionButton>
          {!c.archived_at && !c.converted_task_id && (
            <ActionButton label="Make it a task" onClick={() => act(() => run(convertCaptureAction(c.id), { success: "Added to tasks" }), true)}>
              <IconCheck size={17} />
            </ActionButton>
          )}
          <Menu
            label="More"
            align="start"
            className="flex h-9 min-w-9 items-center justify-center rounded-full px-2 transition hover:bg-gray-150 hover:text-ink"
            items={[
              { label: "Edit", icon: <IconPencil size={15} />, onSelect: () => (setDraft(c.content), setEditing(true)) },
              { label: project ? "Change project" : "File under a project", icon: <IconFolder size={15} />, onSelect: () => setPicking(true) },
              c.archived_at
                ? { label: "Unarchive", icon: <IconUndo size={15} />, onSelect: () => act(() => run(archiveCaptureAction(c.id, false)), false) }
                : { label: "Archive", icon: <IconArchive size={15} />, onSelect: () => act(() => run(archiveCaptureAction(c.id, true)), true) },
              { divider: true },
              { label: "Delete", icon: <IconTrash size={15} />, danger: true, onSelect: () => setConfirm(true) },
            ]}
          >
            <IconDots size={17} />
          </Menu>
          {resurfaced && (
            <Button
              size="sm"
              variant="soft"
              className="ml-auto"
              onClick={() => act(() => run(markCaptureSeenAction(c.id)), true)}
            >
              <IconCheckCircle size={15} /> Seen
            </Button>
          )}
        </div>

        {confirm && (
          <div className="mt-2 flex items-center gap-2 rounded-[14px] bg-gray-100 px-3 py-2 text-[13.5px]" role="alert">
            <span className="flex-1 text-ink-2">Delete this capture? You can undo it from Activity.</span>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Keep
            </Button>
            <Button size="sm" variant="danger" onClick={() => act(() => run(deleteCaptureAction(c.id), { success: "Deleted" }), true)}>
              Delete
            </Button>
          </div>
        )}

        {threadOpen && <CaptureThread captureId={c.id} count={c.comment_count} />}
      </div>

      <ProjectPicker open={picking} onClose={() => setPicking(false)} value={project} onChange={fileUnder} />
      <ResurfacePicker
        open={resurfaceOpen}
        anchor={resurfaceAt}
        onClose={() => setResurfaceOpen(false)}
        target={c}
        onSave={(schedule, startAt) =>
          run(resurfaceCaptureAction(c.id, schedule, startAt), { success: schedule ? "It'll come back" : "Won't come back" })
        }
      />
    </motion.li>
  );
}

function ActionButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-medium transition hover:bg-gray-150 hover:text-ink ${
        active ? "text-accent" : ""
      }`}
    >
      {children}
    </button>
  );
}
