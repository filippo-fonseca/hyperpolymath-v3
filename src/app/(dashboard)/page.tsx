import { Suspense } from "react";
import { requireUser, USER_ACTOR } from "@/lib/session";
import { makeCtx } from "@/server/ctx";
import { ensureDefaultWidgets, listWidgets } from "@/server/widgets";
import { listTasks } from "@/server/tasks";
import { listHabits } from "@/server/habits";
import { listCaptures, resurfacedCaptures } from "@/server/captures";
import { listBots } from "@/server/bots";
import { listActions } from "@/server/log";
import { listReminders } from "@/server/reminders";
import { listRoutines } from "@/server/routines";
import { listAreas } from "@/server/projects";
import { getTaskViews } from "@/server/settings";
import { getProfile } from "@/server/profile";
import { localDate } from "@/lib/time";
import { loadCalendar } from "@/lib/calendar-data";
import type { DashboardData } from "@/lib/dashboard-types";
import { Dashboard } from "@/components/dashboard/dashboard";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";

export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardLoader />
    </Suspense>
  );
}

async function DashboardLoader() {
  const userId = await requireUser();
  const ctx = await makeCtx(userId, USER_ACTOR);
  // Streams separately so a slow or failing Google call never blocks the grid.
  const calendar = loadCalendar(ctx);
  await ensureDefaultWidgets(ctx.db, userId);
  const [widgets, openTasks, doneTasks, habits, captures, resurfaced, bots, actions, reminders, routines, areas, taskViews, profile] = await Promise.all([
    listWidgets(ctx),
    listTasks(ctx, { scope: "open", limit: 500 }),
    listTasks(ctx, { scope: "done", limit: 40 }),
    listHabits(ctx),
    listCaptures(ctx, { limit: 40 }),
    resurfacedCaptures(ctx),
    listBots(ctx),
    listActions(ctx, { limit: 100 }),
    listReminders(ctx),
    listRoutines(ctx),
    // Archived ones too, so the Projects view can show its quiet archive.
    listAreas(ctx, { includeArchived: true }),
    getTaskViews(ctx),
    getProfile(ctx),
  ]);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const data: DashboardData = {
    userId,
    tz: ctx.tz,
    today: localDate(ctx.now, ctx.tz),
    nowIso: ctx.now.toISOString(),
    widgets,
    openTasks,
    doneTasks,
    habits,
    captures,
    resurfaced,
    bots,
    actions,
    reminders,
    routines,
    areas,
    taskViews,
    profile: { display_name: profile.display_name, avatar_url: profile.avatar_url },
    realtime: url && key ? { url, key } : null,
  };
  return <Dashboard data={data} calendar={calendar} />;
}
