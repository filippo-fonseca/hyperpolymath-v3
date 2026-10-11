"use client";

import type { WidgetRow } from "@/lib/dashboard-types";
import { isCustomKind, type WidgetSize } from "@/lib/widgets";
import { ExpandedHeader } from "@/components/dashboard/expanded";
import { TasksWidget } from "./tasks/tasks-widget";
import { TasksView } from "./tasks/tasks-view";
import { HabitsWidget } from "./habits/habits-widget";
import { HabitsView } from "./habits/habits-view";
import { CaptureWidget } from "./capture/capture-widget";
import { CaptureView } from "./capture/capture-view";
import { KiwiWidget } from "./kiwi/kiwi-widget";
import { ActivityView } from "./kiwi/activity-view";
import { CustomWidget, CustomWidgetView } from "./custom/custom-widget";
import { CalendarWidget } from "./calendar/calendar-widget";
import { CalendarView } from "./calendar/calendar-view";
import { ProjectsWidget } from "./projects/projects-widget";
import { ProjectsView } from "./projects/projects-view";

// Maps a widget's kind to its compact body and its expanded view.

export function WidgetBody({ widget, size }: { widget: WidgetRow; size: WidgetSize }) {
  switch (widget.kind) {
    case "tasks":
      return <TasksWidget size={size} />;
    case "habits":
      return <HabitsWidget size={size} />;
    case "capture":
      return <CaptureWidget size={size} />;
    case "kiwi":
      return <KiwiWidget size={size} />;
    case "calendar":
      return <CalendarWidget size={size} />;
    case "projects":
      return <ProjectsWidget size={size} widgetId={widget.id} />;
    default:
      return isCustomKind(widget.kind) ? <CustomWidget widget={widget} size={size} /> : null;
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
    case "kiwi":
      return <ActivityView />;
    case "calendar":
      return <CalendarView />;
    case "projects":
      return <ProjectsView />;
    default:
      return isCustomKind(widget.kind) ? (
        <CustomWidgetView widget={widget} />
      ) : (
        <ExpandedHeader title={widget.title} />
      );
  }
}
