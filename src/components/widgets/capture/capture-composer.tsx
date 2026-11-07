"use client";

import { useRef, useState } from "react";
import type { Schedule } from "@/lib/schedule";
import { createCaptureAction } from "@/app/actions/captures";
import { summarize, choiceFor } from "@/lib/resurface-choice";
import { Button } from "@/components/ui/primitives";
import { IconClose, IconResurface } from "@/components/ui/icons";
import { ProfileAvatar } from "@/components/ui/bot-avatar";
import { useDashboard } from "@/components/dashboard/context";
import { ResurfacePicker } from "./resurface-picker";

const MAX = 20000;

/** "What's on your mind?" with your avatar, like posting to a feed only you read. */
export function CaptureComposer({ autoFocus = false }: { autoFocus?: boolean }) {
  const { data, run } = useDashboard();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState<{ schedule: Schedule; startAt: string | null } | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [picking, setPicking] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const has = text.trim().length > 0;

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  };

  const post = async () => {
    if (!has || busy) return;
    setBusy(true);
    const ok = await run(createCaptureAction(text.trim(), later?.schedule ?? null, null, later?.startAt ?? null), { success: "Captured" });
    setBusy(false);
    if (ok) {
      setText("");
      setLater(null);
      if (area.current) area.current.style.height = "auto";
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void post();
      }}
      className="flex gap-3 rounded-[20px] bg-surface p-3.5 shadow-ring transition focus-within:ring-2 focus-within:ring-accent/25 sm:p-4"
    >
      <ProfileAvatar profile={data.profile} size={40} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <textarea
          ref={area}
          value={text}
          rows={2}
          autoFocus={autoFocus}
          maxLength={MAX}
          aria-label="New capture"
          placeholder="What's on your mind?"
          onChange={(e) => {
            setText(e.target.value);
            grow(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void post();
            }
          }}
          // The card shows focus, so the field itself skips the global focus outline.
          style={{ outline: "none" }}
          className="block w-full resize-none bg-transparent py-1.5 text-[16px] leading-relaxed placeholder:text-ink-3"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-150 pt-2.5">
          {later ? (
            <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-accent-soft pl-3 pr-1 text-[12.5px] font-medium text-accent">
              <IconResurface size={14} className="shrink-0" />
              <span className="truncate">{laterLabel(later, data.tz, data.nowIso)}</span>
              <button
                type="button"
                aria-label="Don't bring it back"
                onClick={() => setLater(null)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-accent/15"
              >
                <IconClose size={13} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                setAnchor(e.currentTarget.getBoundingClientRect());
                setPicking(true);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-ink-2 transition hover:bg-gray-150"
            >
              <IconResurface size={15} />
              Bring it back
            </button>
          )}
          <span className="ml-auto hidden text-[12px] text-ink-3 sm:inline">⌘ Enter to post</span>
          <Button type="submit" size="sm" variant="primary" disabled={!has || busy}>
            Post
          </Button>
        </div>
      </div>
      <ResurfacePicker
        open={picking}
        anchor={anchor}
        onClose={() => setPicking(false)}
        target={null}
        onSave={async (schedule, startAt) => {
          setLater(schedule ? { schedule, startAt } : null);
          return true;
        }}
      />
    </form>
  );
}

/** "Comes back tomorrow at 9am" without the full stop, for the chip. */
function laterLabel(later: { schedule: Schedule; startAt: string | null }, tz: string, nowIso: string) {
  const now = new Date(nowIso);
  const choice = choiceFor(
    { resurface_schedule: later.schedule, resurface_next_at: later.startAt ?? null },
    now,
    tz,
  );
  return summarize(choice, now, tz).replace(/\.$/, "");
}
