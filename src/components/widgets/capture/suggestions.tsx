"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import type { Suggestion } from "@/lib/dashboard-types";
import { dueLabel, pluralize, relativeTime } from "@/lib/format";
import { bySuggestionUrgency, sourcesLabel } from "@/lib/suggestions";
import { acceptSuggestionAction, dismissSuggestionAction, reviewAllSuggestionsAction } from "@/app/actions/suggestions";
import { Button, stop } from "@/components/ui/primitives";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { IconCalendar, IconCheck, IconClose, IconFlag, IconPencil, IconSparkle } from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";
import { ProjectChip } from "../projects/project-bits";

// Things your bots noticed on their own (a deadline in an email, an idea in a
// chat) wait here until you say yes. Accepting makes the real task or capture,
// credited to the bot; dismissing teaches it not to suggest that again.

const EASE = [0.22, 1, 0.36, 1] as const;
type Leaving = "accept" | "dismiss";

function sourceName(s: Suggestion) {
  return s.bot?.name ?? s.source;
}

/** Avatars of who suggested, overlapping like a little crowd. */
function Crowd({ suggestions, size = 22 }: { suggestions: Suggestion[]; size?: number }) {
  const bots = [...new Map(suggestions.filter((s) => s.bot).map((s) => [s.bot!.id, s.bot!])).values()].slice(0, 3);
  if (!bots.length) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-accent text-white" style={{ width: size, height: size }}>
        <IconSparkle size={size - 8} />
      </span>
    );
  }
  return (
    <span className="flex shrink-0 -space-x-1.5">
      {bots.map((b) => (
        <span key={b.id} className="rounded-full bg-surface p-[1.5px]">
          <BotAvatar bot={b} size={size} />
        </span>
      ))}
    </span>
  );
}

/** A number that rolls when it changes. */
function Count({ n }: { n: number }) {
  return (
    <span className="relative inline-flex overflow-hidden tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={n}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * "3 suggested by Kiwi" strip for the Capture widget. Tapping the card opens
 * the tray. `compact` makes it exactly one list row tall (30px).
 */
export function SuggestedBanner({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { data } = useDashboard();
  const list = data.suggestions;
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {list.length > 0 && (
        <motion.div
          key="banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className={`shrink-0 overflow-hidden ${className}`}
        >
          <div
            className={`suggest-glow relative flex items-center gap-2 overflow-hidden rounded-full bg-accent-soft pl-1 pr-3 text-[13px] ${
              compact ? "h-[30px]" : "h-9 pl-1.5"
            }`}
          >
            {!reduce && <span key={list.length} className="suggest-sheen pointer-events-none absolute inset-0" aria-hidden />}
            <Crowd suggestions={list} size={compact ? 20 : 22} />
            <span className="min-w-0 truncate">
              <span className="font-semibold text-accent">
                <Count n={list.length} /> suggested
              </span>
              <span className="text-ink-3"> by {sourcesLabel(list.map(sourceName))}</span>
            </span>
            <span className="ml-auto shrink-0 text-[12px] font-medium text-accent">Review</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * While a card is on screen its `custom` is its index (for the stagger). Once
 * it leaves, AnimatePresence hands it the tray's `leaving` lookup instead, so
 * it exits the way it was decided: lifted when accepted, swept aside when not.
 */
function cardVariants(id: string): Variants {
  return {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    shown: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { duration: 0.34, ease: EASE, delay: Math.min(i, 6) * 0.045 } }),
    leave: (how: ((id: string) => Leaving) | number) =>
      typeof how === "function" && how(id) === "accept"
        ? { opacity: 0, y: -14, scale: 0.97, transition: { duration: 0.28, ease: EASE } }
        : { opacity: 0, x: -48, transition: { duration: 0.24, ease: EASE } },
  };
}

/** The Suggested tray at the top of the Capture view. */
export function SuggestedSection() {
  const { data, run } = useDashboard();
  const [hidden, setHidden] = useState<Map<string, Leaving>>(() => new Map());
  const [bulk, setBulk] = useState<Leaving | null>(null);
  const list = data.suggestions.filter((s) => !hidden.has(s.id)).sort(bySuggestionUrgency);
  // Each card leaves the way it was decided: up when accepted, aside when dismissed.
  const leaving = (id: string): Leaving => hidden.get(id) ?? bulk ?? "dismiss";

  const hide = (id: string, how: Leaving) => setHidden((m) => new Map(m).set(id, how));
  const unhide = (id: string) =>
    setHidden((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });

  const reviewAll = async (decision: Leaving) => {
    const ids = list.map((s) => s.id);
    setBulk(decision);
    setHidden((m) => new Map([...m, ...ids.map((id) => [id, decision] as const)]));
    const res = await run(reviewAllSuggestionsAction(ids, decision), {
      success: decision === "accept" ? `Added ${pluralize(ids.length, "suggestion")}` : "Cleared",
    });
    if (!res) setHidden((m) => new Map([...m].filter(([id]) => !ids.includes(id))));
    setBulk(null);
  };

  return (
    <AnimatePresence initial={false}>
      {list.length > 0 && (
        <motion.section
          key="suggested"
          aria-labelledby="suggested-title"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0, transition: { duration: 0.3, ease: EASE, delay: 0.15 } }}
          transition={{ duration: 0.35, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="suggest-glow mt-6 rounded-[22px] bg-[linear-gradient(160deg,rgb(16_132_254/0.09),rgb(124_92_255/0.05)_55%,transparent)] p-2 shadow-[inset_0_0_0_1px_rgb(16_132_254/0.14)]">
            <div className="flex items-center gap-2 px-2.5 pb-2 pt-1.5">
              <h3 id="suggested-title" className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-accent">
                <IconSparkle size={15} className="suggest-twinkle shrink-0" />
                <span className="shrink-0">
                  Suggested <Count n={list.length} />
                </span>
                <span className="truncate font-normal text-ink-3">· from {sourcesLabel(list.map(sourceName))}</span>
              </h3>
              {list.length > 1 && (
                <div className="ml-auto flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => reviewAll("dismiss")}>
                    Dismiss all
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => reviewAll("accept")}>
                    <IconCheck size={14} strokeWidth={2.4} /> Accept all
                  </Button>
                </div>
              )}
            </div>
            <ul className="flex flex-col gap-1.5">
              <AnimatePresence initial={false} custom={leaving}>
                {list.map((s, i) => (
                  <SuggestionCard key={s.id} s={s} index={i} onHide={hide} onUnhide={unhide} />
                ))}
              </AnimatePresence>
            </ul>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function SuggestionCard({
  s,
  index,
  onHide,
  onUnhide,
}: {
  s: Suggestion;
  index: number;
  onHide: (id: string, how: Leaving) => void;
  onUnhide: (id: string) => void;
}) {
  const { data, nowMs, run } = useDashboard();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.content);
  const [due, setDue] = useState(s.due_date ?? "");
  const [done, setDone] = useState(false);
  const isTask = s.kind === "task";
  const name = sourceName(s);
  const dueText = dueLabel(s.due_date, data.today);
  const overdue = !!s.due_date && s.due_date < data.today;

  const accept = async () => {
    const edits = editing
      ? { content: draft.trim() || s.content, dueDate: isTask ? due || null : undefined }
      : {};
    // A beat of green, then the card lifts away.
    setDone(true);
    await new Promise((r) => window.setTimeout(r, 260));
    onHide(s.id, "accept");
    const ok = await run(acceptSuggestionAction(s.id, edits), { success: isTask ? "Added to tasks" : "Captured" });
    if (!ok) {
      setDone(false);
      onUnhide(s.id);
    }
  };
  const dismiss = async () => {
    onHide(s.id, "dismiss");
    if (!(await run(dismissSuggestionAction(s.id)))) onUnhide(s.id);
  };

  return (
    <motion.li
      layout="position"
      custom={index}
      variants={cardVariants(s.id)}
      initial="hidden"
      animate="shown"
      exit="leave"
      className="group relative flex gap-3 rounded-[16px] bg-surface px-3.5 py-3 shadow-[0_1px_2px_rgb(20_20_20/0.05),inset_0_0_0_1px_rgb(20_20_20/0.04)]"
    >
      <div className="pt-0.5">
        {s.bot ? (
          <BotAvatar bot={s.bot} size={34} />
        ) : (
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-accent-soft text-accent">
            <IconSparkle size={17} />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-3">
          <span className="truncate font-semibold text-ink">{name}</span>
          <span className="shrink-0">suggests {isTask ? "a task" : "a capture"}</span>
          <span className="shrink-0 text-gray-400" aria-hidden>
            ·
          </span>
          <time dateTime={s.created_at} className="shrink-0">
            {relativeTime(s.created_at, nowMs)}
          </time>
        </div>

        {editing ? (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <textarea
              value={draft}
              autoFocus
              rows={isTask ? 1 : 3}
              maxLength={2000}
              aria-label={isTask ? "Task title" : "Capture text"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (isTask || e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void accept();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              className="block w-full resize-y rounded-[12px] bg-gray-100 px-3 py-2 text-[15px] leading-snug outline-none focus:bg-white focus:shadow-ring"
            />
            {isTask && (
              <label className="flex items-center gap-2 text-[13px] text-ink-3">
                <IconCalendar size={14} />
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  aria-label="Due date"
                  className="h-8 rounded-[10px] bg-gray-100 px-2 text-[13px] text-ink outline-none focus:bg-white focus:shadow-ring"
                />
                {due && (
                  <button type="button" onClick={() => setDue("")} className="text-[12.5px] text-accent hover:underline">
                    No date
                  </button>
                )}
              </label>
            )}
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug">{s.content}</p>
        )}

        {s.reason && !editing && (
          <p className="mt-1 line-clamp-2 border-l-2 border-accent/30 pl-2 text-[13px] leading-snug text-ink-3">{s.reason}</p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {!editing && dueText && (
            <span
              className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-medium ${
                overdue ? "bg-danger-soft text-[#d61a2f]" : "bg-gray-100 text-gray-700"
              }`}
            >
              <IconCalendar size={12} />
              {dueText}
              {s.due_time ? ` ${s.due_time.slice(0, 5)}` : ""}
            </span>
          )}
          {!editing && s.priority > 0 && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-gray-100 px-2 text-[12px] font-medium text-gray-700">
              <IconFlag size={12} />
              {["", "Low", "Medium", "High"][s.priority]}
            </span>
          )}
          {!editing && s.project_id && <ProjectChip projectId={s.project_id} />}

          <div className="ml-auto flex items-center gap-1">
            {!editing ? (
              <Button size="sm" variant="ghost" onClick={() => (setDraft(s.content), setDue(s.due_date ?? ""), setEditing(true))}>
                <IconPencil size={14} /> Edit
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss suggestion"
              title="Dismiss (it won't be suggested again for a month)"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-150 hover:text-ink"
            >
              <IconClose size={16} />
            </button>
            <motion.button
              type="button"
              onClick={accept}
              onPointerDown={stop}
              disabled={done}
              whileTap={{ scale: 0.95 }}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-white transition-colors duration-200 ${
                done ? "bg-success" : "bg-accent hover:bg-accent-hover"
              }`}
            >
              <motion.span
                key={done ? "done" : "idle"}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 600, damping: 22 }}
                className="flex"
              >
                <IconCheck size={14} strokeWidth={2.6} />
              </motion.span>
              {done ? "Added" : editing ? "Save and add" : isTask ? "Add task" : "Capture it"}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.li>
  );
}
