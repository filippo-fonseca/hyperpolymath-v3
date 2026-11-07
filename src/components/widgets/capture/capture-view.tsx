"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { Capture } from "@/lib/dashboard-types";
import { pluralize } from "@/lib/format";
import { searchCapturesAction } from "@/app/actions/captures";
import { IconResurface, IconSearch } from "@/components/ui/icons";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { KiwiReading } from "@/components/illustrations";
import { useDashboard } from "@/components/dashboard/context";
import { CaptureComposer } from "./capture-composer";
import { CapturePost } from "./capture-post";

/** Captures as a feed you post to yourself, with what came back pinned on top. */
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

  const resurfaced = searching ? [] : data.resurfaced.filter((c) => !hidden.has(c.id));
  const backIds = new Set(resurfaced.map((c) => c.id));
  // A capture that came back shows once, in Resurfaced, not again in the feed.
  const list = (searching ? (results ?? []) : data.captures).filter((c) => !hidden.has(c.id) && !backIds.has(c.id));
  const hide = (id: string) => setHidden((s) => new Set(s).add(id));
  const unhide = (id: string) => setHidden((s) => (s.delete(id), new Set(s)));

  return (
    <div className="mx-auto max-w-[640px]">
      <ExpandedHeader eyebrow={`${pluralize(data.captures.length, "capture")} in your inbox`} title="Capture" />
      <CaptureComposer autoFocus />

      <div className="mt-4 flex items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-gray-100 px-3.5 text-ink-3 focus-within:bg-white focus-within:shadow-ring">
          <IconSearch size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search captures"
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

      {resurfaced.length > 0 && (
        <section className="mt-7" aria-labelledby="resurfaced-title">
          <h3 id="resurfaced-title" className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-accent">
            <IconResurface size={15} />
            Resurfaced
            <span className="font-normal text-ink-3">· stays here until you mark it seen</span>
          </h3>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {resurfaced.map((c) => (
                <CapturePost key={c.id} c={c} resurfaced onHide={hide} onUnhide={unhide} />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <section className="mt-7" aria-labelledby="feed-title">
        <h3 id="feed-title" className="mb-1 text-[13px] font-semibold text-gray-500">
          {searching ? "Results" : "Recent"}
        </h3>
        {list.length === 0 ? (
          searching ? (
            <div className="py-10 text-center text-[14px] text-ink-3">Nothing matches.</div>
          ) : (
            <div className="flex flex-col items-center pb-4 pt-2 text-center">
              <KiwiReading size={148} />
              <p className="mt-1 text-[14px] text-ink-3">Nothing captured yet. Anything you jot down lands here.</p>
            </div>
          )
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {list.map((c) => (
                <CapturePost key={c.id} c={c} onHide={hide} onUnhide={unhide} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
