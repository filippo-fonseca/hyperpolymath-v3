"use client";

import { useEffect, useState } from "react";
import type { ActionRow, Bot } from "@/lib/dashboard-types";
import { relativeTime } from "@/lib/format";
import { archiveBotAction, loadActionsAction, revertActionAction } from "@/app/actions/activity";
import { addTeammateAction, updateBotAction } from "@/app/actions/teammates";
import { AVATAR_COLORS, AVATAR_SHAPES, BotAvatar } from "@/components/ui/bot-avatar";
import { Button, EmptyNote, fieldClass } from "@/components/ui/primitives";
import { IconChevronRight, IconUndo } from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";
import { ConfirmCard, Field, SectionTitle, selectClass, selectStyle, textareaClass } from "./form";

/** Edit a teammate: avatar, role, description, who it reports to; its widgets, recent actions, archive. */
export function BotEditor({ botId, onDone }: { botId: string; onDone: () => void }) {
  const { data } = useDashboard();
  const bot = data.bots.find((b) => b.id === botId);
  if (!bot) return <EmptyNote>This teammate was archived or removed.</EmptyNote>;
  return <BotForm key={bot.id} bot={bot} onDone={onDone} />;
}

/** Register a bot by hand, the same way its first MCP call would. */
export function AddTeammate({ onAdded }: { onAdded: (botId: string) => void }) {
  const { run } = useDashboard();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-4 pb-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        const bot = await run(addTeammateAction({ name, role }), { success: `Added ${name.trim()}` });
        setBusy(false);
        if (bot) onAdded(bot.id);
      }}
    >
      <p className="text-[13px] leading-snug text-ink-3">
        Use the bot&apos;s exact name in Grok Bot, so its MCP calls land on this teammate. It reports to Kiwi until you
        change that.
      </p>
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Slack Roundup"
          maxLength={60}
          required
          autoFocus
          className={`${fieldClass} w-full`}
        />
      </Field>
      <Field label="Role">
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Reads Slack every night"
          maxLength={120}
          className={`${fieldClass} w-full`}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="dark" disabled={!name.trim() || busy}>
          {busy ? "Adding…" : "Add teammate"}
        </Button>
      </div>
    </form>
  );
}

/** Ids of a bot and everything under it, so it can't report to its own sub-bot. */
function subtree(bots: Bot[], rootId: string) {
  const out = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of bots) {
      if (b.parent_id && out.has(b.parent_id) && !out.has(b.id)) {
        out.add(b.id);
        grew = true;
      }
    }
  }
  return out;
}

function BotForm({ bot, onDone }: { bot: Bot; onDone: () => void }) {
  const { data, run, open } = useDashboard();
  const parentName = data.bots.find((b) => b.id === bot.parent_id)?.name ?? "";
  const [role, setRole] = useState(bot.role ?? "");
  const [description, setDescription] = useState(bot.description ?? "");
  const [parent, setParent] = useState(parentName);
  const [shape, setShape] = useState(bot.avatar_shape);
  const [color, setColor] = useState(bot.avatar_color);
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const blocked = subtree(data.bots, bot.id);
  const parents = data.bots.filter((b) => !blocked.has(b.id));
  const widgets = data.widgets.filter((w) => w.owner_bot_id === bot.id);

  const patch: Parameters<typeof updateBotAction>[1] = {};
  if (role.trim() !== (bot.role ?? "")) patch.role = role;
  if (description.trim() !== (bot.description ?? "")) patch.description = description;
  if (parent !== parentName) patch.parent = parent || null;
  if (shape !== bot.avatar_shape) patch.avatar_shape = shape;
  if (color !== bot.avatar_color) patch.avatar_color = color;
  const dirty = Object.keys(patch).length > 0;

  const save = async () => {
    setBusy(true);
    const ok = await run(updateBotAction(bot.name, patch), { success: `Saved ${bot.name}` });
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <div className="flex flex-col gap-7 pb-2">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && !busy) void save();
        }}
      >
        {!bot.is_coordinator && (
          <div className="flex items-center gap-4">
            <BotAvatar bot={{ name: bot.name, avatar_shape: shape, avatar_color: color }} size={52} />
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Avatar shape">
                {AVATAR_SHAPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={shape === s}
                    aria-label={s}
                    onClick={() => setShape(s)}
                    className={`flex h-8 w-8 items-center justify-center rounded-[10px] transition ${
                      shape === s ? "bg-gray-150 shadow-ring" : "hover:bg-gray-100"
                    }`}
                  >
                    <BotAvatar bot={{ name: s, avatar_shape: s, avatar_color: color }} size={22} />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Avatar color">
                {Object.entries(AVATAR_COLORS).map(([name, hex]) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={color === name}
                    aria-label={name}
                    onClick={() => setColor(name)}
                    className="flex h-6 w-6 items-center justify-center rounded-full transition"
                    style={{ boxShadow: color === name ? `0 0 0 2px var(--surface), 0 0 0 3.5px ${hex}` : undefined }}
                  >
                    <span className="h-5 w-5 rounded-full" style={{ background: hex }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <Field label="Role">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={bot.is_coordinator ? "Coordinator" : "e.g. Slack roundup"}
            maxLength={120}
            className={`${fieldClass} w-full`}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this bot does for you"
            maxLength={2000}
            rows={3}
            className={textareaClass}
          />
        </Field>
        <Field label="Reports to">
          <select value={parent} onChange={(e) => setParent(e.target.value)} className={selectClass} style={selectStyle}>
            <option value="">Nobody (top level)</option>
            {parents.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="dark" disabled={!dirty || busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <section>
        <SectionTitle>Widgets</SectionTitle>
        {widgets.length === 0 ? (
          <p className="text-[13.5px] text-ink-3">{bot.name} doesn&apos;t publish any widgets.</p>
        ) : (
          <ul className="divide-y divide-gray-150">
            {widgets.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => open(w.id)}
                  className="flex w-full items-center gap-3 py-2.5 text-left text-[14px] transition hover:text-ink"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{w.title}</span>
                  <span className="shrink-0 text-[12.5px] capitalize text-ink-3">{w.kind}</span>
                  <IconChevronRight size={15} className="shrink-0 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecentActions bot={bot} />

      {!bot.is_coordinator &&
        (confirmArchive ? (
          <ConfirmCard
            text={`Archive ${bot.name}? Its history stays, and it comes back if it acts again.`}
            action="Archive"
            busy={busy}
            onCancel={() => setConfirmArchive(false)}
            onConfirm={async () => {
              setBusy(true);
              const ok = await run(archiveBotAction(bot.name), { success: `Archived ${bot.name}` });
              setBusy(false);
              if (ok) onDone();
            }}
          />
        ) : (
          <Button variant="danger" className="self-start" onClick={() => setConfirmArchive(true)}>
            Archive teammate
          </Button>
        ))}
    </div>
  );
}

function RecentActions({ bot }: { bot: Bot }) {
  const { data, nowMs, run } = useDashboard();
  const [rows, setRows] = useState<ActionRow[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Refetch whenever fresh data arrives (a realtime refresh replaces data.actions).
  useEffect(() => {
    let live = true;
    void run(loadActionsAction({ botId: bot.id, limit: 8 }), { quiet: true }).then((r) => {
      if (live && r) setRows(r);
    });
    return () => {
      live = false;
    };
  }, [bot.id, run, data.actions]);

  return (
    <section>
      <SectionTitle>Recent actions</SectionTitle>
      {rows === null ? (
        <div className="skeleton h-10 rounded-[12px]" />
      ) : rows.length === 0 ? (
        <p className="text-[13.5px] text-ink-3">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-gray-150">
          {rows.map((a) => {
            const reverted = !!a.reverted_at;
            return (
              <li key={a.id} className="py-2.5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className={`text-[14px] leading-snug ${reverted ? "text-ink-3 line-through decoration-gray-400" : ""}`}>
                      {a.summary}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-gray-500">{relativeTime(a.created_at, nowMs)}</div>
                  </div>
                  {!reverted && a.entity_id && confirmId !== a.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmId(a.id)}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      <IconUndo size={14} /> Revert
                    </button>
                  )}
                </div>
                {confirmId === a.id && (
                  <div className="mt-2">
                    <ConfirmCard
                      text="Put this back the way it was before?"
                      action="Revert"
                      onCancel={() => setConfirmId(null)}
                      onConfirm={async () => {
                        setConfirmId(null);
                        await run(revertActionAction(a.id), { success: "Reverted" });
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
