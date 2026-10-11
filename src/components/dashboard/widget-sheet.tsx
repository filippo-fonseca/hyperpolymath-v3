"use client";

import { useState } from "react";
import type { WidgetRow } from "@/lib/dashboard-types";
import { isCustomKind, type WidgetSize } from "@/lib/widgets";
import { scheduleInWords } from "@/lib/cron-words";
import { removeWidgetAction, updateWidgetAction } from "@/app/actions/widgets";
import { Button, Segmented, Sheet, fieldClass } from "@/components/ui/primitives";
import { WidgetIcon } from "@/components/ui/widget-icon";
import { IconChevronRight, IconPlus } from "@/components/ui/icons";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { selectClass, selectStyle } from "@/components/teammates/form";
import { useDashboard } from "./context";

const STALE_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 3, label: "3 hours" },
  { hours: 6, label: "6 hours" },
  { hours: 12, label: "12 hours" },
  { hours: 24, label: "1 day" },
  { hours: 48, label: "2 days" },
  { hours: 168, label: "1 week" },
];

/**
 * Per-widget settings, from edit mode or an expanded widget: title, size,
 * page, and for bot widgets the staleness window, owner bot, linked routines
 * and remove.
 */
export function WidgetSheet({
  widget,
  pageCount,
  onClose,
  onResize,
  onMove,
  onRemoved,
}: {
  widget: (WidgetRow & { size: WidgetSize }) | null;
  pageCount: number;
  onClose: () => void;
  onResize: (s: WidgetSize) => void;
  onMove: (page: number) => void;
  onRemoved: (id: string) => void;
}) {
  return (
    <Sheet open={!!widget} onClose={onClose} title={widget?.title ?? ""} width={400}>
      {widget && (
        <SheetBody
          key={widget.id}
          widget={widget}
          pageCount={pageCount}
          onResize={onResize}
          onMove={onMove}
          onRemoved={onRemoved}
        />
      )}
    </Sheet>
  );
}

function SheetBody({
  widget,
  pageCount,
  onResize,
  onMove,
  onRemoved,
}: {
  widget: WidgetRow & { size: WidgetSize };
  pageCount: number;
  onResize: (s: WidgetSize) => void;
  onMove: (page: number) => void;
  onRemoved: (id: string) => void;
}) {
  const { data, run, openTeammates } = useDashboard();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const custom = isCustomKind(widget.kind);
  const [title, setTitle] = useState(widget.title);
  const [stale, setStale] = useState(widget.stale_after_hours ? String(widget.stale_after_hours) : "");
  const [owner, setOwner] = useState(widget.owner_bot_id ?? "");
  const [icon, setIcon] = useState(widget.icon ?? "");
  const routines = data.routines.filter((r) => r.widget_id === widget.id);
  const staleOptions =
    widget.stale_after_hours && !STALE_OPTIONS.some((o) => o.hours === widget.stale_after_hours)
      ? [...STALE_OPTIONS, { hours: widget.stale_after_hours, label: `${widget.stale_after_hours} hours` }]
      : STALE_OPTIONS;

  const patch: Parameters<typeof updateWidgetAction>[1] = {};
  if (title.trim() && title.trim() !== widget.title) patch.title = title;
  if (custom && (stale ? Number(stale) : null) !== widget.stale_after_hours) patch.stale_after_hours = stale ? Number(stale) : null;
  if (custom && (owner || null) !== widget.owner_bot_id) patch.owner_bot_id = owner || null;
  if (custom && (icon.trim() || null) !== (widget.icon ?? null)) patch.icon = icon.trim() || null;
  const dirty = Object.keys(patch).length > 0;

  const save = async () => {
    setBusy(true);
    await run(updateWidgetAction(widget.id, patch), { success: "Widget saved" });
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-6 pb-2">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && !busy) void save();
        }}
      >
        <Row label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className={`${fieldClass} w-full`}
            aria-label="Title"
          />
        </Row>
        {custom && (
          <>
            <Row label="Icon">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gray-100 shadow-ring">
                  {/^https:\/\//i.test(icon.trim()) || (icon.trim() && [...icon.trim()].length <= 4) ? (
                    <WidgetIcon icon={icon.trim()} size={22} />
                  ) : (
                    <span className="text-[11px] text-ink-3">{icon.trim() ? "site" : "none"}</span>
                  )}
                </span>
                <input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  maxLength={500}
                  placeholder="slack.com, an emoji, or an image URL"
                  className={`${fieldClass} min-w-0 flex-1`}
                  aria-label="Icon"
                />
              </div>
            </Row>
            <Row label="Made by">
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className={selectClass}
                style={selectStyle}
                aria-label="Owner bot"
              >
                <option value="">No owner</option>
                {widget.owner && !data.bots.some((b) => b.id === widget.owner!.id) && (
                  <option value={widget.owner.id}>{widget.owner.name} (archived)</option>
                )}
                {data.bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Greys out when not updated for">
              <select
                value={stale}
                onChange={(e) => setStale(e.target.value)}
                className={selectClass}
                style={selectStyle}
                aria-label="Staleness window"
              >
                <option value="">Never</option>
                {staleOptions.map((o) => (
                  <option key={o.hours} value={o.hours}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Row>
          </>
        )}
        {dirty && (
          <Button type="submit" variant="dark" className="self-end" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        )}
      </form>
      <Row label="Size">
        <Segmented<WidgetSize>
          value={widget.size}
          onChange={onResize}
          options={[
            { value: "s", label: "Small" },
            { value: "m", label: "Medium" },
            { value: "l", label: "Large" },
          ]}
        />
      </Row>
      <Row label="Page">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: pageCount }, (_, p) => (
            <button
              key={p}
              type="button"
              onClick={() => onMove(p)}
              className={`h-8 min-w-8 rounded-full px-3 text-[13px] font-medium transition ${
                widget.page === p ? "bg-ink text-white" : "bg-gray-150 text-ink-2 hover:bg-gray-200"
              }`}
            >
              {p + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onMove(pageCount)}
            className="flex h-8 items-center gap-1 rounded-full bg-gray-150 px-3 text-[13px] font-medium text-ink-2 transition hover:bg-gray-200"
          >
            <IconPlus size={14} /> New page
          </button>
        </div>
      </Row>
      {custom && (
        <Row label="Routines that publish here">
          {routines.length === 0 ? (
            <p className="text-[13px] leading-snug text-ink-3">
              None registered. A bot links its routine when it registers it, or link one from Teammates.
            </p>
          ) : (
            <ul className="divide-y divide-gray-150">
              {routines.map((r) => {
                const bot = data.bots.find((b) => b.id === r.bot_id) ?? r.bot;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openTeammates({ routineId: r.id })}
                      className="flex w-full items-center gap-2.5 py-2 text-left transition hover:text-ink"
                    >
                      {bot && <BotAvatar bot={bot} size={20} />}
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[14px] font-medium ${r.enabled ? "" : "text-ink-3"}`}>{r.name}</span>
                        <span className="block truncate text-[12.5px] text-gray-500">
                          {r.enabled ? scheduleInWords(r.schedule) : "Paused"}
                        </span>
                      </span>
                      <IconChevronRight size={15} className="shrink-0 text-gray-400" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Row>
      )}
      {custom ? (
        confirm ? (
          <div className="rounded-[16px] bg-gray-100 p-4">
            <p className="text-[14px] text-ink-2">Remove “{widget.title}”? The bot can publish a new one later.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="dark"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const ok = await run(removeWidgetAction(widget.id), { success: "Widget removed" });
                  setBusy(false);
                  if (ok) onRemoved(widget.id);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirm(true)} className="self-start">
            Remove widget
          </Button>
        )
      ) : (
        <p className="text-[13px] text-ink-3">Built-in widgets can be moved and resized, but not removed.</p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] font-medium text-ink-2">{label}</div>
      {children}
    </div>
  );
}

const KINDS: { kind: string; text: string }[] = [
  { kind: "Digest", text: "Sections of items, like an email or Slack roundup." },
  { kind: "List", text: "A simple checklist or reading list." },
  { kind: "Stat", text: "One number with a trend line." },
  { kind: "Timeline", text: "Timestamped events." },
  { kind: "Markdown", text: "Free-form notes." },
  { kind: "Table", text: "Rows and columns." },
];

export function AddWidgetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add widget" width={440}>
      <p className="text-[14px] leading-relaxed text-ink-2">
        Custom widgets are published by your bots. Ask Kiwi in Grok Bot, for example:
      </p>
      <p className="mt-3 rounded-[14px] bg-gray-100 px-4 py-3 text-[14px] leading-relaxed">
        “Make me a digest widget with my unread email every morning.”
      </p>
      <div className="mt-5 divide-y divide-gray-150">
        {KINDS.map((k) => (
          <div key={k.kind} className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="text-[14px] font-medium">{k.kind}</span>
            <span className="text-right text-[13px] text-ink-3">{k.text}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
