"use client";

import type { WidgetRow } from "@/lib/dashboard-types";
import type { WidgetSize } from "@/lib/widgets";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { Eyebrow } from "@/components/ui/primitives";
import { TasksWidget } from "./tasks/tasks-widget";
import { TasksView } from "./tasks/tasks-view";
import { HabitsWidget } from "./habits/habits-widget";
import { HabitsView } from "./habits/habits-view";
import { CaptureWidget } from "./capture/capture-widget";
import { CaptureView } from "./capture/capture-view";

// Maps a widget's kind to its compact body and its expanded view.

export function WidgetBody({ widget, size }: { widget: WidgetRow; size: WidgetSize }) {
  switch (widget.kind) {
    case "tasks":
      return <TasksWidget size={size} />;
    case "habits":
      return <HabitsWidget size={size} />;
    case "capture":
      return <CaptureWidget size={size} />;
    default:
      return <Fallback widget={widget} size={size} />;
  }
}

export function WidgetExpanded({ widget }: { widget: WidgetRow }) {
  switch (widget.kind) {
    case "tasks":
      return <TasksView />;
    case "habits":
      return <HabitsView />;
    case "capture":
      return <CaptureView />;
    default:
      return <ExpandedHeader eyebrow={widget.kind} title={widget.title} />;
  }
}

function Fallback({ widget }: { widget: WidgetRow; size: WidgetSize }) {
  return <Eyebrow>{widget.title}</Eyebrow>;
}
