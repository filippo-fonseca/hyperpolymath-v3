"use client";

import type { WidgetRow } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { Eyebrow } from "@/components/ui/primitives";

// Maps a widget's kind to its compact body and its expanded view.

export function WidgetBody({ widget, size }: { widget: WidgetRow; size: WidgetSize }) {
  switch (widget.kind) {
    default:
      return <Fallback widget={widget} size={size} />;
  }
}

export function WidgetExpanded({ widget }: { widget: WidgetRow }) {
  switch (widget.kind) {
    default:
      return <ExpandedHeader eyebrow={widget.kind} title={widget.title} />;
  }
}

function Fallback({ widget }: { widget: WidgetRow; size: WidgetSize }) {
  return <Eyebrow>{widget.title}</Eyebrow>;
}
