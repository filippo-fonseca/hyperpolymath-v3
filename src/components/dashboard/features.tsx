"use client";

import type { ReactNode } from "react";
import type { WidgetRow } from "@/lib/dashboard-types";
import { FIXED_KINDS, isCustomKind, type FixedKind } from "@/lib/widgets";
import { WidgetIcon } from "@/components/ui/widget-icon";
import { IconActivity, IconCalendar, IconCheckCircle, IconFolder, IconPencil, IconTarget, IconWidgets } from "@/components/ui/icons";

// The built-in features: what each one is called in navigation, its slug in
// the URL (?view=tasks) and its glyph. Custom widgets use their id as the slug.

type Feature = { slug: string; label: string; tint: string; icon: (size: number) => ReactNode };

export const FEATURES: Record<FixedKind, Feature> = {
  tasks: { slug: "tasks", label: "Tasks", tint: "var(--accent)", icon: (s) => <IconCheckCircle size={s} /> },
  calendar: { slug: "calendar", label: "Calendar", tint: "#f2484b", icon: (s) => <IconCalendar size={s} /> },
  habits: { slug: "habits", label: "Habits", tint: "#2fb26b", icon: (s) => <IconTarget size={s} /> },
  projects: { slug: "projects", label: "Projects", tint: "#8a63f2", icon: (s) => <IconFolder size={s} /> },
  capture: { slug: "capture", label: "Capture", tint: "#f0a020", icon: (s) => <IconPencil size={s} /> },
  kiwi: { slug: "activity", label: "Activity", tint: "var(--ink)", icon: (s) => <IconActivity size={s} /> },
};

/** Navigation order, which is not the order kinds were added in. */
export const FEATURE_ORDER: FixedKind[] = ["tasks", "calendar", "habits", "projects", "capture", "kiwi"];

const isFixed = (k: string): k is FixedKind => (FIXED_KINDS as readonly string[]).includes(k);

export function viewKeyFor(w: Pick<WidgetRow, "id" | "kind">): string {
  return isFixed(w.kind) ? FEATURES[w.kind].slug : w.id;
}

export function widgetForView<W extends Pick<WidgetRow, "id" | "kind">>(widgets: W[], key: string | null): W | null {
  if (!key) return null;
  return widgets.find((w) => viewKeyFor(w) === key) ?? null;
}

export function featureLabel(w: Pick<WidgetRow, "kind" | "title">): string {
  return isFixed(w.kind) ? FEATURES[w.kind].label : w.title;
}

/** The glyph for a widget's kind, tinted; custom widgets show their own icon. */
export function KindIcon({
  widget,
  size = 15,
  tinted = true,
  className = "",
}: {
  widget: Pick<WidgetRow, "kind" | "icon">;
  size?: number;
  tinted?: boolean;
  className?: string;
}) {
  if (isFixed(widget.kind)) {
    const f = FEATURES[widget.kind];
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        style={{ width: size, height: size, color: tinted ? f.tint : undefined }}
        aria-hidden
      >
        {f.icon(size)}
      </span>
    );
  }
  if (isCustomKind(widget.kind) && widget.icon) return <WidgetIcon icon={widget.icon} size={size} className={className} />;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center text-gray-500 ${className}`} style={{ width: size, height: size }} aria-hidden>
      <IconWidgets size={size} />
    </span>
  );
}
