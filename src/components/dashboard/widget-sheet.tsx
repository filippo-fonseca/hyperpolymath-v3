"use client";

import { useState } from "react";
import type { WidgetRow } from "@/lib/dashboard-types";
import { isCustomKind, type WidgetSize } from "@/lib/widgets";
import { removeWidgetAction } from "@/app/actions/widgets";
import { Button, Segmented, Sheet } from "@/components/ui/primitives";
import { IconPlus } from "@/components/ui/icons";
import { useDashboard } from "./context";

/** Per-widget settings in edit mode: size, page, and remove (custom only). */
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
  const { run } = useDashboard();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const custom = isCustomKind(widget.kind);

  return (
    <div className="flex flex-col gap-6 pb-2">
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
