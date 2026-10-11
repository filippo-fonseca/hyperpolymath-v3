// Client-safe types for dashboard data. Type-only imports from the service
// layer are erased at build time, so nothing server-only reaches the bundle.

import type { Database } from "./database.types";
import type { HabitWithStatus } from "@/server/habits";
import type { listWidgets } from "@/server/widgets";
import type { listActions } from "@/server/log";
import type { listReminders } from "@/server/reminders";
import type { widgetHistory } from "@/server/widgets";
import type { listRoutines, listRuns } from "@/server/routines";
import type { CalendarEvent } from "@/server/google/calendar";

export type { CalendarEvent };

type T = Database["public"]["Tables"];

export type Task = T["tasks"]["Row"];
export type Capture = T["captures"]["Row"];
export type Bot = T["bots"]["Row"];
export type Habit = HabitWithStatus;
export type WidgetRow = Awaited<ReturnType<typeof listWidgets>>[number];
export type ActionRow = Awaited<ReturnType<typeof listActions>>[number];
export type ReminderRow = Awaited<ReturnType<typeof listReminders>>[number];
export type RoutineRow = Awaited<ReturnType<typeof listRoutines>>[number];
export type RoutineRun = Awaited<ReturnType<typeof listRuns>>[number];
export type Snapshot = Awaited<ReturnType<typeof widgetHistory>>[number];
export type TaskStatus = "todo" | "doing" | "done";

export type DashboardData = {
  userId: string;
  tz: string;
  today: string;
  nowIso: string;
  widgets: WidgetRow[];
  openTasks: Task[];
  doneTasks: Task[];
  habits: Habit[];
  captures: Capture[];
  resurfacing: Capture[];
  bots: Bot[];
  actions: ActionRow[];
  reminders: ReminderRow[];
  routines: RoutineRow[];
  realtime: { url: string; key: string } | null;
};

export type CalendarAccount = {
  id: string;
  email: string;
  calendar_ids: string[];
  default_calendar_id: string;
  enabled: boolean;
  is_default: boolean;
};

export type CalendarData = {
  configured: boolean;
  accounts: CalendarAccount[];
  events: CalendarEvent[];
  error: string | null;
  from: string;
  to: string;
};
