"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { CaptureComment } from "@/lib/dashboard-types";
import { addCommentAction, deleteCommentAction, listCommentsAction, updateCommentAction } from "@/app/actions/capture-comments";
import { relativeTime } from "@/lib/format";
import { IconArrowUp, IconDots, IconPencil, IconTrash } from "@/components/ui/icons";
import { BotAvatar, ProfileAvatar } from "@/components/ui/bot-avatar";
import { Menu } from "@/components/ui/menu";
import { Button } from "@/components/ui/primitives";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { useDashboard } from "@/components/dashboard/context";

type Comment = CaptureComment;

/**
 * Replies under a capture: yours with your avatar, a bot's with its own.
 * Loads when opened, and again when a refresh changes the reply count.
 */
export function CaptureThread({ captureId, count }: { captureId: string; count: number }) {
  const { run } = useDashboard();
  const [comments, setComments] = useState<Comment[] | null>(null);

  useEffect(() => {
    let live = true;
    void run(listCommentsAction(captureId), { quiet: true }).then((res) => {
      if (live && res) setComments(res);
    });
    return () => {
      live = false;
    };
  }, [captureId, count, run]);

  const add = async (text: string) => {
    const created = await run(addCommentAction(captureId, text));
    if (created) setComments((cs) => [...(cs ?? []), created]);
    return created;
  };

  return (
    <div className="mt-3">
      {comments === null ? (
        count > 0 && (
          <div className="flex h-12 items-center justify-center">
            <KiwiLoader size={22} label="Loading replies" />
          </div>
        )
      ) : (
        <ul className="flex flex-col">
          <AnimatePresence initial={false}>
            {comments.map((c, i) => (
              <Reply
                key={c.id}
                c={c}
                last={i === comments.length - 1}
                onChanged={(next) => setComments((cs) => (cs ?? []).map((x) => (x.id === c.id ? { ...x, ...next } : x)))}
                onDeleted={() => setComments((cs) => (cs ?? []).filter((x) => x.id !== c.id))}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <ReplyBox onSubmit={add} />
    </div>
  );
}

function Reply({
  c,
  last,
  onChanged,
  onDeleted,
}: {
  c: Comment;
  last: boolean;
  onChanged: (next: Partial<Comment>) => void;
  onDeleted: () => void;
}) {
  const { data, nowMs, run } = useDashboard();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.content);
  const mine = c.author_kind === "user";
  const name = mine ? data.profile.display_name?.trim() || "You" : (c.bot?.name ?? "A bot");

  const save = async () => {
    const text = draft.trim();
    if (!text || text === c.content) return setEditing(false);
    const res = await run(updateCommentAction(c.id, text), { success: "Reply updated" });
    if (res) {
      onChanged({ content: res.content, updated_at: res.updated_at });
      setEditing(false);
    }
  };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
      className="group/reply relative flex gap-2.5 pb-3"
    >
      {/* thread line joining the avatars */}
      {!last && <span aria-hidden className="absolute bottom-0 left-[13px] top-8 w-px bg-gray-200" />}
      {mine || !c.bot ? (
        <ProfileAvatar profile={data.profile} size={28} />
      ) : (
        <BotAvatar bot={c.bot} size={28} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="truncate font-semibold">{name}</span>
          <span className="shrink-0 text-gray-500">{relativeTime(c.created_at, nowMs)}</span>
          {c.updated_at !== c.created_at && <span className="shrink-0 text-gray-400">· edited</span>}
          {mine && !editing && (
            <Menu
              label="Reply options"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 opacity-100 transition hover:bg-gray-150 sm:opacity-0 sm:group-hover/reply:opacity-100 sm:focus-visible:opacity-100"
              items={[
                { label: "Edit", icon: <IconPencil size={15} />, onSelect: () => (setDraft(c.content), setEditing(true)) },
                {
                  label: "Delete",
                  icon: <IconTrash size={15} />,
                  danger: true,
                  onSelect: async () => {
                    if (await run(deleteCommentAction(c.id), { success: "Reply deleted" })) onDeleted();
                  },
                },
              ]}
            >
              <IconDots size={16} />
            </Menu>
          )}
        </div>
        {editing ? (
          <div className="mt-1">
            <textarea
              value={draft}
              autoFocus
              rows={2}
              maxLength={5000}
              aria-label="Edit reply"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
                if (e.key === "Escape") setEditing(false);
              }}
              className="block w-full resize-none rounded-[12px] bg-gray-100 px-3 py-2 text-[14px] leading-relaxed outline-none focus:bg-white focus:shadow-ring"
            />
            <div className="mt-1.5 flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="dark" onClick={save} disabled={!draft.trim()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">{c.content}</p>
        )}
      </div>
    </motion.li>
  );
}

function ReplyBox({ onSubmit }: { onSubmit: (text: string) => Promise<unknown> }) {
  const { data } = useDashboard();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const has = text.trim().length > 0;
  const send = async () => {
    if (!has || busy) return;
    setBusy(true);
    const ok = await onSubmit(text.trim());
    setBusy(false);
    if (ok) setText("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="flex items-center gap-2.5"
    >
      <ProfileAvatar profile={data.profile} size={28} />
      <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-gray-100 pl-3.5 pr-1 transition focus-within:bg-white focus-within:shadow-ring">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          placeholder="Reply"
          aria-label="Write a reply"
          className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          aria-label="Send reply"
          disabled={!has || busy}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${has ? "bg-accent text-white" : "bg-gray-200 text-gray-500"}`}
        >
          <IconArrowUp size={15} strokeWidth={2.2} />
        </button>
      </div>
    </form>
  );
}
