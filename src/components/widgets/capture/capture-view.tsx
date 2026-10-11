"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Capture } from "@/lib/dashboard-types";
import { relativeTime } from "@/lib/format";
import {
  archiveCaptureAction,
  convertCaptureAction,
  createCaptureAction,
  deleteCaptureAction,
  searchCapturesAction,
} from "@/app/actions/captures";
import { Button, IconButton } from "@/components/ui/primitives";
import { IconArchive, IconCheck, IconSearch, IconTrash, IconUndo } from "@/components/ui/icons";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { useDashboard } from "@/components/dashboard/context";
import { QuickAdd } from "../tasks/task-bits";

export function CaptureView() {
  const { data, run } = useDashboard();
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [results, setResults] = useState<Capture[] | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const searching = query.trim() !== "" || archived;

  useEffect(() => {
    if (!searching) return;
    let live = true;
    const t = window.setTimeout(async () => {
      const res = await run(searchCapturesAction(query.trim(), archived), { quiet: true });
      if (live && res) setResults(res);
    }, 220);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [query, archived, searching, run, data.captures]);

  const list = (searching ? (results ?? []) : data.captures).filter((c) => !hidden.has(c.id));
  const resurfacing = searching ? [] : data.resurfacing.filter((c) => !hidden.has(c.id));
  const hide = (id: string) => setHidden((s) => new Set(s).add(id));
  const unhide = (id: string) => setHidden((s) => (s.delete(id), new Set(s)));

  return (
    <div>
      <ExpandedHeader eyebrow={`${data.captures.length} in your inbox`} title="Capture" />
      <QuickAdd
        autoFocus
        placeholder="What's on your mind?"
        onSubmit={(content) => run(createCaptureAction(content), { success: "Captured" })}
      />
      <div className="mt-4 flex items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-gray-100 px-3.5 text-ink-3 focus-within:bg-white focus-within:shadow-ring">
          <IconSearch size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
          />
        </label>
        <button
          type="button"
          aria-pressed={archived}
          onClick={() => setArchived((v) => !v)}
          className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition ${
            archived ? "bg-ink text-white" : "bg-gray-150 text-ink-2 hover:bg-gray-200"
          }`}
        >
          Include archived
        </button>
      </div>

      {resurfacing.length > 0 && (
        <section className="mt-7">
          <h3 className="mb-1 text-[13px] font-semibold text-accent">Resurfacing today</h3>
          <ul className="divide-y divide-gray-150">
            {resurfacing.map((c) => (
              <CaptureRow key={c.id} c={c} onHide={hide} onUnhide={unhide} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-7">
        <h3 className="mb-1 text-[13px] font-semibold text-gray-500">{searching ? "Results" : "Recent"}</h3>
        {list.length === 0 ? (
          <div className="py-10 text-center text-[14px] text-ink-3">
            {searching ? "Nothing matches." : "Nothing captured yet. Anything you jot down lands here."}
          </div>
        ) : (
          <ul className="divide-y divide-gray-150">
            <AnimatePresence initial={false}>
              {list.map((c) => (
                <CaptureRow key={c.id} c={c} onHide={hide} onUnhide={unhide} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}

function CaptureRow({ c, onHide, onUnhide }: { c: Capture; onHide: (id: string) => void; onUnhide: (id: string) => void }) {
  const { nowMs, run } = useDashboard();
  const [confirm, setConfirm] = useState(false);

  const act = async (p: () => Promise<unknown>, hide: boolean) => {
    if (hide) onHide(c.id);
    const ok = await p();
    if (!ok && hide) onUnhide(c.id);
  };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      className="group py-3"
    >
      <p className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${c.archived_at ? "text-ink-3" : ""}`}>
        {c.content}
      </p>
      {c.urls.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {c.urls.slice(0, 3).map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="max-w-full truncate text-[13px] text-accent hover:underline">
              {u.replace(/^https?:\/\//, "")}
            </a>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[12.5px] text-gray-500">
          {c.source !== "you" ? `${c.source} · ` : ""}
          {relativeTime(c.created_at, nowMs)}
          {c.archived_at ? " · archived" : ""}
          {c.converted_task_id ? " · became a task" : ""}
        </span>
        <div className="ml-auto flex items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          {confirm ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Keep
              </Button>
              <Button size="sm" variant="danger" onClick={() => act(() => run(deleteCaptureAction(c.id), { success: "Deleted" }), true)}>
                Delete
              </Button>
            </>
          ) : (
            <>
              {!c.archived_at && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => act(() => run(convertCaptureAction(c.id), { success: "Added to tasks" }), true)}
                >
                  <IconCheck size={15} /> To task
                </Button>
              )}
              {c.archived_at ? (
                <IconButton label="Unarchive" className="h-8 w-8" onClick={() => act(() => run(archiveCaptureAction(c.id, false)), false)}>
                  <IconUndo size={15} />
                </IconButton>
              ) : (
                <IconButton label="Archive" className="h-8 w-8" onClick={() => act(() => run(archiveCaptureAction(c.id, true)), true)}>
                  <IconArchive size={15} />
                </IconButton>
              )}
              <IconButton label="Delete" className="h-8 w-8" onClick={() => setConfirm(true)}>
                <IconTrash size={15} />
              </IconButton>
            </>
          )}
        </div>
      </div>
    </motion.li>
  );
}
