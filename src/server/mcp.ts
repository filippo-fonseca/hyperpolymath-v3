import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppError, makeCtx, type Ctx } from "./ctx";
import { archiveBot, renameBot, resolveBotActor, listBots, setCoordinator, updateBot } from "./bots";
import { getOverview } from "./overview";
import { completeTask, createTask, deleteTask, listTasks, reopenTask, updateTask } from "./tasks";
import { cancelReminder, listReminders, setReminder, snoozeReminder } from "./reminders";
import { createHabit, listHabits, logHabit, updateHabit } from "./habits";
import { convertCaptureToTask, createCapture, listCaptures, markCaptureSeen, updateCapture } from "./captures";
import { addComment, listComments } from "./capture-comments";
import { acceptSuggestion, dismissSuggestion, listSuggestions, suggest } from "./suggestions";
import { createWidget, listWidgets, publishWidget, removeWidget, updateWidget } from "./widgets";
import { listActions, revertAction } from "./log";
import { setTimezone } from "./settings";
import { createArea, createProject, deleteProject, getProject, listAreas, updateArea, updateProject } from "./projects";
import { finishRun, listRoutines, registerRoutine, removeRoutine, startRun, updateRoutine } from "./routines";
import { createEvent, deleteEvent, listCalendars, listEvents, updateEvent } from "./google/calendar";
import { scheduleSchema } from "@/lib/schedule";
import { recurrenceSchema } from "@/lib/recurrence";
import { CUSTOM_KINDS, PAYLOAD_DOCS, WIDGET_SIZES } from "@/lib/widgets";
import { isLocalDate, isLocalTime } from "@/lib/time";
import { BATCH_LIMIT, DAILY_LIMIT_PER_SOURCE } from "@/lib/suggestions";

/**
 * Server instructions every client receives on connect. Keep them short and
 * client-neutral: persona, voice and platform-specific routine wiring belong
 * in the client's own standing prompt (docs/STANDING-PROMPT.md), not here. Detail that
 * only matters when a tool is in use belongs in that tool's description.
 */
const BASE_INSTRUCTIONS = `Hyperpolymath is the owner's life dashboard and the source of truth for their tasks, reminders, habits, captures, projects, calendar and dashboard widgets. The owner sees every change in the app and can revert it.

- Call get_overview first in any conversation about their tasks, habits or day, and use its now and timezone, never your own clock or memory.
- Pass your own agent name as \`bot\` on every call; it attributes your changes in the activity log. Results omit null fields.
- "X is done": find the task (get_overview, or list_tasks with query) and complete_task. If nothing matches, ask before creating one.
- "Remind me / nudge me ... at X / every Y / until Z" becomes a task (if there is something to do) plus set_reminder. Hyperpolymath delivers due reminders to the coordinator itself, so never build a separate scheduled job in your own platform just to remind the owner. "Until I say it's done" = until "done"; "until Friday" = "date"; "three times" = "count". Times are 24h HH:MM in the owner's timezone.
- Quick thoughts, links and ideas without a clear action are captures (create_capture), not tasks. "Bring this back Friday" on an idea is a capture resurface schedule, not a reminder.
- File a task or capture under a project only when it clearly fits one; otherwise leave it unfiled. Never create a project or area just to file one item. Confirm where it went using the result's filed_under ("Added to Machine Elements." / "Added, not filed under a project.").
- After creating or moving something dated, say the date in words ("tomorrow, Mon Oct 12"). With no date given, leave due_date empty rather than guess.
- Use these calendar tools (not another calendar connector) so changes are logged. Never invite people unless asked.
- When you notice something the owner would likely want as a task or capture and they didn't ask you to save it, call suggest (with a short reason); they review it in the app. Direct requests still go straight to create_task / create_capture.
- Create or publish widgets only when the owner asked for something on the dashboard.
- Scheduled routines: if you run recurring work on your platform, register_routine it, call start_routine_run at the start of every run (stop if enabled is false) and finish_routine_run at the end. On scheduled runs, message the owner only when something is new or needs them.
- When you create a helper agent, call update_bot with its role and parent so it appears under you.
- Ask before deleting anything. Own mistakes and undo them with revert_action.`;

const bot = z.string().min(1).max(60).describe("Your agent name");
const date = z.string().refine(isLocalDate, "YYYY-MM-DD").describe("Local date YYYY-MM-DD");
const time = z.string().refine(isLocalTime, "HH:MM").describe("Local time HH:MM (24h)");
// Refinements validate without emitting zod's long regexes into tools/list.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.string().refine((v) => UUID_RE.test(v), "expected a uuid");
const ISO_DATETIME = z.iso.datetime({ offset: true });
const isoDateTime = z
  .string()
  .refine((v) => ISO_DATETIME.safeParse(v).success, "expected an ISO datetime with offset")
  .describe("ISO datetime");

const taskFields = {
  notes: z.string().max(10000).nullable().optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  priority: z.number().int().min(0).max(3).optional().describe("0 none, 1 low, 2 medium, 3 high"),
  project: z.string().max(120).nullable().optional().describe("Project name or id (see list_areas); null clears"),
  due_date: date.nullable().optional(),
  due_time: time.nullable().optional(),
  recurrence: recurrenceSchema.nullable().optional().describe("Repeat rule. Completing rolls the due date forward."),
};

const reminderFields = {
  schedule: scheduleSchema.describe(
    'When to nudge, e.g. {"type":"daily","times":["10:00"],"days":[1,3,5]} or every 3h 9 to 22: {"type":"interval","every_minutes":180,"window":{"start":"09:00","end":"22:00"}}',
  ),
  until: z
    .enum(["done", "date", "count", "once"])
    .optional()
    .describe('done (default with a task): until completed; date: until until_date; count: after count nudges; once'),
  until_date: date.optional(),
  count: z.number().int().min(1).max(500).optional(),
};

const resurfaceField = scheduleSchema.describe(
  'When it comes back (shown in Resurfaced until marked seen). Reminder schedule shape, e.g. {"type":"once","date":"2026-11-14","time":"09:00"}; every 3 days: {"type":"interval","every_minutes":4320}',
);

const resurfaceStart = isoDateTime
  .optional()
  .describe("ISO datetime a repeating resurface starts from");

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

/** Keys a bot never needs back: the owner's own id and soft-delete bookkeeping. */
const DROP_KEYS = new Set(["user_id", "deleted_at", "updated_at"]);
/** Null fields the instructions rely on, so they stay even when empty. */
const KEEP_NULL = new Set(["filed_under"]);

/**
 * Tool results are read by a model on every call, so send compact JSON and
 * leave out nulls and bookkeeping columns. Absent means null.
 */
export function leanJson(data: unknown): string {
  return JSON.stringify(data, function (key, value) {
    if (DROP_KEYS.has(key)) return undefined;
    if (value === null && key !== "" && !KEEP_NULL.has(key) && !Array.isArray(this)) return undefined;
    return value;
  });
}

function ok(data: Json) {
  return { content: [{ type: "text" as const, text: leanJson(data) }] };
}

function fail(e: unknown) {
  const msg =
    e instanceof AppError
      ? e.message
      : e instanceof z.ZodError
        ? e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")
        : "Something went wrong on the Hyperpolymath side.";
  if (!(e instanceof AppError) && !(e instanceof z.ZodError)) console.error("[mcp]", e);
  return { content: [{ type: "text" as const, text: msg }], isError: true };
}

/** "Project (Area)" for confirmations, or null when unfiled. */
async function filedUnder(ctx: Ctx, projectId: string | null | undefined) {
  if (!projectId) return null;
  const { data } = await ctx.db
    .from("projects")
    .select("name, area:areas(name)")
    .eq("id", projectId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!data) return null;
  const area = (data.area as { name: string } | null)?.name;
  return area ? `${data.name} (${area})` : data.name;
}

/** Instructions plus who the coordinator is, so every client agrees on names. */
function instructions(coordinator: string | null) {
  const who = coordinator
    ? `The owner's main assistant (coordinator) is "${coordinator}". `
    : "No coordinator yet: the first agent to call a tool becomes it. ";
  return `${BASE_INSTRUCTIONS}
- Names: ${who}If your name no longer matches the one you are registered under (list_bots), call rename_bot once with the old and new names first, so your history carries over.`;
}

export function buildMcpServer(userId: string, coordinator: string | null = null) {
  const server = new McpServer({ name: "hyperpolymath", version: "3.0.0" }, { instructions: instructions(coordinator) });

  /** Register a tool whose handler runs with a bot-attributed context. */
  function tool<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    run: (ctx: Ctx, args: z.infer<z.ZodObject<S>>) => Promise<Json>,
    hints: { readOnly?: boolean; destructive?: boolean } = {},
  ) {
    const inputSchema = { bot, ...shape };
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: { readOnlyHint: !!hints.readOnly, destructiveHint: !!hints.destructive },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (async (args: any) => {
        try {
          const ctx0 = await makeCtx(userId, { kind: "system", name: "mcp" });
          const actor = await resolveBotActor(ctx0.db, userId, args.bot);
          return ok(await run({ ...ctx0, actor }, args));
        } catch (e) {
          return fail(e);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );
  }

  // Context ------------------------------------------------------------------
  tool("get_overview", "Today's tasks and overdue items, inbox, habits, captures (with resurfaced ones waiting to be seen), reminders and widgets in one call. Call this first.", {}, (ctx) => getOverview(ctx), { readOnly: true });

  tool(
    "set_timezone",
    "Change the owner's timezone (IANA name, e.g. Europe/Rome) when they travel. Days, habits and reminder times follow it.",
    { timezone: z.string().min(3).max(60) },
    (ctx, a) => setTimezone(ctx, a.timezone),
  );

  // Tasks --------------------------------------------------------------------
  tool(
    "list_tasks",
    "List tasks. scope: today (due today or overdue), overdue, upcoming (next 14 days), inbox (no date), open, done, all.",
    {
      scope: z.enum(["today", "overdue", "upcoming", "inbox", "open", "done", "all"]).optional(),
      project: z.string().max(120).optional().describe("Project name or id"),
      area: z.string().max(80).optional().describe("Area name or id: tasks in any of its projects"),
      query: z.string().max(200).optional().describe("Case-insensitive title search"),
      limit: z.number().int().min(1).max(200).optional(),
    },
    (ctx, a) => listTasks(ctx, a),
    { readOnly: true },
  );
  tool(
    "create_task",
    "Create a task. Optionally attach a reminder in the same call.",
    { title: z.string().min(1).max(500), ...taskFields, reminder: z.object(reminderFields).optional() },
    async (ctx, { reminder, ...input }) => {
      const task = await createTask(ctx, input);
      const filed_under = await filedUnder(ctx, task.project_id);
      if (!reminder) return { ...task, filed_under };
      const r = await setReminder(ctx, { task_id: task.id, ...reminder });
      return { task, filed_under, reminder: { id: r.id, describes: r.describes, first_fire_at: r.first_fire_at } };
    },
  );
  tool(
    "update_task",
    "Change a task's fields. Pass only what changes; null clears a field.",
    { id: uuid, title: z.string().min(1).max(500).optional(), ...taskFields },
    async (ctx, { id, ...input }) => {
      const task = await updateTask(ctx, id, input);
      return { ...task, filed_under: await filedUnder(ctx, task.project_id) };
    },
  );
  tool("complete_task", "Mark a task done. Recurring tasks roll to their next date. Stops until-done reminders.", { id: uuid }, (ctx, a) => completeTask(ctx, a.id));
  tool("reopen_task", "Mark a done task as not done.", { id: uuid }, (ctx, a) => reopenTask(ctx, a.id));
  tool("delete_task", "Delete a task (recoverable via revert_action). Ask the owner first.", { id: uuid }, (ctx, a) => deleteTask(ctx, a.id), { destructive: true });

  // Reminders ----------------------------------------------------------------
  tool(
    "set_reminder",
    "Schedule nudges for a task (task_id) or a free-standing message. Nudges are delivered to the owner through the coordinator bot.",
    { task_id: uuid.optional(), message: z.string().max(500).optional(), ...reminderFields },
    (ctx, a) => setReminder(ctx, a),
  );
  tool(
    "list_reminders",
    "Active reminders with their next fire time.",
    { task_id: uuid.optional(), include_inactive: z.boolean().optional() },
    (ctx, a) => listReminders(ctx, { taskId: a.task_id, includeInactive: a.include_inactive }),
    { readOnly: true },
  );
  tool(
    "snooze_reminder",
    "Push a reminder's next nudge later: minutes from now, or an ISO datetime.",
    { id: uuid, minutes: z.number().int().min(5).max(60 * 24 * 14).optional(), until: isoDateTime.optional() },
    (ctx, a) => snoozeReminder(ctx, a.id, a),
  );
  tool("cancel_reminder", "Stop a reminder.", { id: uuid }, (ctx, a) => cancelReminder(ctx, a.id));

  // Habits -------------------------------------------------------------------
  tool("list_habits", "Habits with today's progress (0 to 3), streaks and this week.", {}, (ctx) => listHabits(ctx), { readOnly: true });
  tool(
    "log_habit",
    "Record habit progress. Defaults: today, done (3). 0 clears.",
    { habit: z.string().describe("Habit name or id"), date: date.optional(), progress: z.number().int().min(0).max(3).optional() },
    (ctx, a) => logHabit(ctx, a.habit, a),
  );
  tool(
    "create_habit",
    "Create a habit.",
    { name: z.string().min(1).max(120), icon: z.string().max(8).optional().describe("An emoji"), days_of_week: z.array(z.number().int().min(0).max(6)).min(1).optional().describe("0 = Sunday"), area: z.string().max(80).optional() },
    (ctx, a) => createHabit(ctx, a),
  );
  tool(
    "update_habit",
    "Rename, reschedule or archive a habit.",
    { habit: z.string(), name: z.string().max(120).optional(), icon: z.string().max(8).nullable().optional(), days_of_week: z.array(z.number().int().min(0).max(6)).min(1).optional(), archived: z.boolean().optional(), area: z.string().max(80).nullable().optional() },
    (ctx, { habit, ...patch }) => updateHabit(ctx, habit, patch),
  );

  // Captures -----------------------------------------------------------------
  tool(
    "create_capture",
    "Save a quick thought, link or idea. resurface brings it back on a schedule.",
    { content: z.string().min(1).max(20000), resurface: resurfaceField.optional(), resurface_start: resurfaceStart, project: z.string().max(120).optional() },
    async (ctx, a) => {
      const capture = await createCapture(ctx, a);
      return { ...capture, filed_under: await filedUnder(ctx, capture.project_id) };
    },
  );
  tool(
    "list_captures",
    "Recent captures, newest first.",
    { query: z.string().max(200).optional(), include_archived: z.boolean().optional(), limit: z.number().int().min(1).max(100).optional() },
    (ctx, a) => listCaptures(ctx, { query: a.query, includeArchived: a.include_archived, limit: a.limit }),
    { readOnly: true },
  );
  tool(
    "update_capture",
    "Edit or archive a capture, file it under a project, or set when it resurfaces (resurface: a schedule, null stops it).",
    { id: uuid, content: z.string().min(1).max(20000).optional(), resurface: resurfaceField.nullable().optional(), resurface_start: resurfaceStart, archived: z.boolean().optional(), project: z.string().max(120).nullable().optional() },
    (ctx, { id, ...patch }) => updateCapture(ctx, id, patch),
  );
  tool(
    "mark_capture_seen",
    "Take a resurfaced capture out of the Resurfaced section once the owner has seen it. Its resurface schedule keeps running.",
    { id: uuid },
    (ctx, a) => markCaptureSeen(ctx, a.id),
  );
  tool(
    "list_capture_comments",
    "The reply thread under a capture, oldest first, with who wrote each reply.",
    { capture_id: uuid },
    async (ctx, a) =>
      (await listComments(ctx, a.capture_id)).map((c) => ({
        id: c.id,
        by: c.author_kind === "bot" ? (c.bot?.name ?? "a bot") : "owner",
        content: c.content,
        at: c.created_at,
      })),
    { readOnly: true },
  );
  tool(
    "add_capture_comment",
    "Reply in a capture's thread, as you. Only when you add something useful (a link, next step, answer); read list_capture_comments first.",
    { capture_id: uuid, content: z.string().min(1).max(5000) },
    async (ctx, a) => {
      const c = await addComment(ctx, a.capture_id, a.content);
      return { id: c.id, capture_id: c.capture_id, content: c.content, at: c.created_at };
    },
  );
  tool(
    "convert_capture_to_task",
    "Turn a capture into a task (archives the capture).",
    { id: uuid, title: z.string().max(500).optional(), due_date: date.optional(), priority: z.number().int().min(0).max(3).optional(), project: z.string().max(120).optional() },
    (ctx, { id, ...task }) => convertCaptureToTask(ctx, id, task),
  );

  // Suggestions --------------------------------------------------------------
  const suggestionItem = z.object({
    kind: z.enum(["task", "capture"]),
    content: z.string().min(1).max(2000).describe("Task title, or the capture's text"),
    reason: z.string().max(300).optional().describe('Why, and where you saw it: "Slack #mech-e: Prof. Lee moved the pset to Fri"'),
    project: z.string().max(120).optional().describe("Project name or id, only if it clearly fits"),
    due_date: date.optional(),
    due_time: time.optional(),
    priority: z.number().int().min(0).max(3).optional(),
    notes: z.string().max(4000).optional(),
  });
  tool(
    "suggest",
    `Propose tasks or captures you noticed on your own that the owner did NOT ask you to save (deadlines in emails or Slack, meeting follow-ups, ideas worth keeping). They wait in the app's Suggested tray until the owner accepts or dismisses them. Batch a whole run into one call (up to ${BATCH_LIMIT}). The server skips duplicates, things already saved and recently dismissed ones, so don't check first. Each bot gets ${DAILY_LIMIT_PER_SOURCE} a day: suggest only what the owner would plausibly act on.`,
    { items: z.array(suggestionItem).min(1).max(BATCH_LIMIT) },
    (ctx, a) => suggest(ctx, a.items),
  );
  tool(
    "list_suggestions",
    "Suggestions waiting for the owner (default), or recently accepted or dismissed ones, newest first.",
    { status: z.enum(["pending", "accepted", "dismissed"]).optional(), limit: z.number().int().min(1).max(100).optional() },
    async (ctx, a) =>
      (await listSuggestions(ctx, a)).map((s) => ({
        id: s.id,
        kind: s.kind,
        content: s.content,
        reason: s.reason,
        due: s.due_date ? `${s.due_date}${s.due_time ? " " + s.due_time.slice(0, 5) : ""}` : null,
        by: s.source,
        status: s.status,
        at: s.created_at,
      })),
    { readOnly: true },
  );
  tool(
    "review_suggestion",
    "Accept or dismiss a waiting suggestion, only when the owner says so (\"yes, add the second one\"). Accepting creates the task or capture; content, project, due_date and priority override what was suggested.",
    {
      id: uuid,
      decision: z.enum(["accept", "dismiss"]),
      content: z.string().min(1).max(2000).optional(),
      project: z.string().max(120).nullable().optional(),
      due_date: date.nullable().optional(),
      priority: z.number().int().min(0).max(3).optional(),
    },
    async (ctx, { id, decision, ...edits }) => {
      if (decision === "dismiss") {
        const s = await dismissSuggestion(ctx, id);
        return { dismissed: s.content };
      }
      const r = await acceptSuggestion(ctx, id, edits);
      const projectId = "project_id" in r.created ? r.created.project_id : null;
      return { accepted: r.kind, id: r.created.id, filed_under: await filedUnder(ctx, projectId) };
    },
  );

  // Areas and projects -------------------------------------------------------
  const projectFields = {
    area: z.string().max(80).nullable().optional().describe("Area name or id"),
    description: z.string().max(4000).nullable().optional(),
    emoji: z.string().max(8).nullable().optional(),
    status: z.enum(["active", "paused", "done"]).optional(),
    start_date: date.nullable().optional(),
    end_date: date.nullable().optional(),
    is_class: z.boolean().optional(),
    course_code: z.string().max(40).nullable().optional(),
    term: z.string().max(40).nullable().optional().describe('e.g. "Fall 2026"'),
  };
  tool(
    "list_areas",
    "Life areas with their projects (status, open and done task counts). Use the names or ids with the task and capture tools.",
    { include_archived: z.boolean().optional() },
    (ctx, a) => listAreas(ctx, { includeArchived: a.include_archived }),
    { readOnly: true },
  );
  tool(
    "create_area",
    "Create a life area (School, Health, Work...), with an emoji. Only for a genuinely new part of life; most new things are projects in an existing area.",
    { name: z.string().min(1).max(80), emoji: z.string().max(8).optional(), color: z.string().max(20).optional() },
    (ctx, a) => createArea(ctx, a),
  );
  tool(
    "update_area",
    "Rename, re-emoji or archive an area.",
    { area: z.string().min(1).max(80), name: z.string().max(80).optional(), emoji: z.string().max(8).nullable().optional(), color: z.string().max(20).nullable().optional(), archived: z.boolean().optional() },
    (ctx, { area, ...patch }) => updateArea(ctx, area, patch),
  );
  tool("get_project", "A project with its tasks and recent captures. Use for \"where am I on X?\".", { project: z.string().min(1).max(120) }, (ctx, a) => getProject(ctx, a.project), { readOnly: true });
  tool(
    "create_project",
    "Create a project inside an area. Classes are projects with is_class, course_code and term.",
    { name: z.string().min(1).max(120), ...projectFields },
    (ctx, a) => createProject(ctx, a),
  );
  tool(
    "update_project",
    "Edit a project: status (active, paused, done), dates, area, description, or archive it. When a project moves on, update its status.",
    { project: z.string().min(1).max(120), name: z.string().max(120).optional(), archived: z.boolean().optional(), ...projectFields },
    (ctx, { project, ...patch }) => updateProject(ctx, project, patch),
  );
  tool("delete_project", "Delete a project (tasks stay, unlinked). Ask first; prefer archiving.", { project: z.string().min(1).max(120) }, (ctx, a) => deleteProject(ctx, a.project), { destructive: true });

  // Calendar -----------------------------------------------------------------
  const eventFields = {
    date: date.optional(),
    start_time: time.nullable().optional().describe("Omit or null for an all-day event"),
    end_time: time.optional(),
    duration_minutes: z.number().int().min(5).max(24 * 60).optional().describe("Used when end_time is omitted (default 60)"),
    end_date: date.optional().describe("For multi-day events"),
    location: z.string().max(500).nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
  };
  tool(
    "list_events",
    "Calendar events across the owner's shown Google calendars, between two local dates (inclusive). Defaults to the next 7 days.",
    { from: date.optional(), to: date.optional(), query: z.string().max(200).optional() },
    (ctx, a) => listEvents(ctx, a),
    { readOnly: true },
  );
  tool("list_calendars", "Connected Google calendars, which are shown on the dashboard, and the default for new events.", {}, (ctx) => listCalendars(ctx), { readOnly: true });
  tool(
    "create_event",
    "Add an event to Google Calendar (the default calendar unless `calendar` names one: an account email, calendar name or id).",
    { title: z.string().min(1).max(300), calendar: z.string().max(200).optional(), ...eventFields, date },
    (ctx, a) => createEvent(ctx, a),
  );
  tool(
    "update_event",
    "Move or edit an event. Pass only what changes.",
    { id: z.string().min(3), title: z.string().min(1).max(300).optional(), ...eventFields },
    (ctx, { id, ...input }) => updateEvent(ctx, id, input),
  );
  tool("delete_event", "Remove an event from Google Calendar. Ask first.", { id: z.string().min(3) }, (ctx, a) => deleteEvent(ctx, a.id), { destructive: true });

  // Widgets ------------------------------------------------------------------
  tool("list_widgets", "Widgets on the dashboard, with owner bot and last publish time.", {}, (ctx) => listWidgets(ctx), { readOnly: true });
  tool(
    "create_widget",
    `Add a custom widget owned by you. Only when the owner asked for this on the dashboard. ${PAYLOAD_DOCS}`,
    {
      kind: z.enum(CUSTOM_KINDS),
      title: z.string().min(1).max(60),
      size: z.enum(WIDGET_SIZES).optional().describe("s = 1x1, m = 2x1, l = 2x2, w = full row. Leave out for a sensible default per kind"),
      stale_after_hours: z.number().int().min(1).max(24 * 30).optional().describe("Dim the widget if not republished within this many hours"),
      icon: z.string().max(500).optional().describe("An emoji, an https image URL, or the domain of the site it covers (e.g. slack.com) to use its favicon"),
      payload: z.record(z.string(), z.unknown()).optional(),
    },
    (ctx, a) => createWidget(ctx, a),
  );
  tool(
    "publish_widget",
    `Replace a custom widget's content (by title or id). ${PAYLOAD_DOCS}`,
    { widget: z.string().describe("Widget title or id"), payload: z.record(z.string(), z.unknown()) },
    (ctx, a) => publishWidget(ctx, a.widget, a.payload),
  );
  tool(
    "update_widget",
    "Change a widget's title, icon (emoji, https image URL, or a domain for its favicon; null clears) or staleness window.",
    {
      widget: z.string().describe("Widget title or id"),
      title: z.string().min(1).max(60).optional(),
      icon: z.string().max(500).nullable().optional(),
      stale_after_hours: z.number().int().min(1).max(24 * 30).nullable().optional(),
    },
    (ctx, { widget, ...patch }) => updateWidget(ctx, widget, patch),
  );
  tool("remove_widget", "Remove a custom widget from the dashboard. Ask first.", { widget: z.string() }, (ctx, a) => removeWidget(ctx, a.widget), { destructive: true });

  // Teammates and audit ------------------------------------------------------
  tool("list_bots", "Bots that have worked on Hyperpolymath, with roles and who coordinates whom.", {}, (ctx) => listBots(ctx), { readOnly: true });
  tool(
    "update_bot",
    "Describe a teammate bot (yourself or one you created): role, description, parent (coordinator name), avatar.",
    {
      name: z.string().min(1).max(60),
      role: z.string().max(120).optional(),
      description: z.string().max(2000).optional(),
      parent: z.string().max(60).nullable().optional(),
      avatar_shape: z.enum(["blob", "squircle", "hex", "pebble", "tablet", "wedge"]).optional(),
      avatar_color: z.enum(["blue", "green", "orange", "magenta", "violet", "cyan", "red", "brown"]).optional(),
    },
    async (ctx, { name, ...patch }) => {
      // Make sure the named bot exists (registers it on first mention).
      await resolveBotActor(ctx.db, ctx.userId, name);
      return updateBot(ctx, name, patch);
    },
  );
  tool("archive_bot", "Retire a teammate bot from the dashboard (its history stays). Ask first.", { name: z.string().min(1).max(60) }, (ctx, a) => archiveBot(ctx, a.name), { destructive: true });
  // Routines -----------------------------------------------------------------
  tool(
    "list_routines",
    "Routines registered in Hyperpolymath, with owner bot, schedule, enabled state, linked widget and last run.",
    { bot_name: z.string().max(60).optional() },
    async (ctx, a) => {
      let botId: string | undefined;
      if (a.bot_name) {
        const b = await resolveBotActor(ctx.db, ctx.userId, a.bot_name);
        botId = b.kind === "bot" ? b.botId : undefined;
      }
      return listRoutines(ctx, { botId });
    },
    { readOnly: true },
  );
  tool(
    "register_routine",
    "Register (or update by name) a scheduled routine you run on your platform, so the owner sees and can pause it in the app. Owner defaults to you.",
    {
      name: z.string().min(1).max(120),
      schedule: z.string().max(200).optional().describe('In words, e.g. "weeknights at 10pm"'),
      description: z.string().max(2000).optional(),
      widget: z.string().max(120).optional().describe("Title or id of the widget this routine publishes to"),
      grokbot_routine_id: z.string().max(200).optional().describe("The routine's id on your platform, if any"),
      owner: z.string().max(60).optional().describe("Bot that owns it, if registering for another bot"),
    },
    (ctx, { owner, ...input }) => registerRoutine(ctx, { ...input, bot: owner }),
  );
  tool(
    "update_routine",
    "Change a registered routine (by id or name): schedule, description, widget link, enabled.",
    {
      routine: z.string().min(1).max(120),
      name: z.string().min(1).max(120).optional(),
      schedule: z.string().max(200).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      widget: z.string().max(120).nullable().optional(),
      enabled: z.boolean().optional(),
    },
    (ctx, { routine, ...patch }) => updateRoutine(ctx, routine, patch),
  );
  tool("remove_routine", "Remove a registered routine (after deleting it on your platform).", { routine: z.string().min(1).max(120) }, (ctx, a) => removeRoutine(ctx, a.routine), { destructive: true });
  tool(
    "start_routine_run",
    "Call at the START of every routine run. If enabled is false, the owner paused it in the app: stop without doing the work.",
    { routine: z.string().min(1).max(120) },
    (ctx, a) => startRun(ctx, a.routine),
  );
  tool(
    "finish_routine_run",
    "Call at the END of a routine run with the run_id from start_routine_run.",
    { run_id: uuid, status: z.enum(["ok", "error"]).optional(), summary: z.string().max(500).optional() },
    (ctx, a) => finishRun(ctx, a.run_id, a),
  );

  tool(
    "rename_bot",
    "Rename a registered bot, keeping its history, routines and widgets.",
    { from: z.string().min(1).max(60), to: z.string().min(1).max(60) },
    (ctx, a) => renameBot(ctx, a.from, a.to),
  );
  tool(
    "set_coordinator",
    "Make a bot the owner's main assistant. Only when the owner asks.",
    { name: z.string().min(1).max(60) },
    (ctx, a) => setCoordinator(ctx, a.name),
  );
  tool(
    "list_actions",
    "Recent activity log: what each bot (and the owner) changed.",
    { bot_name: z.string().optional(), limit: z.number().int().min(1).max(100).optional() },
    async (ctx, a) => {
      let botId: string | undefined;
      if (a.bot_name) {
        const b = await resolveBotActor(ctx.db, ctx.userId, a.bot_name);
        botId = b.kind === "bot" ? b.botId : undefined;
      }
      const rows = await listActions(ctx, { botId, limit: a.limit ?? 20 });
      return rows.map((r) => ({ id: r.id, at: r.created_at, by: r.bot?.name ?? r.actor_kind, summary: r.summary, reverted: !!r.reverted_at }));
    },
    { readOnly: true },
  );
  tool(
    "revert_action",
    "Undo an action from the activity log by id. force=true overrides the changed-since check.",
    { id: uuid, force: z.boolean().optional() },
    (ctx, a) => revertAction(ctx, a.id, a.force),
    { destructive: true },
  );

  leanToolList(server);
  return server;
}

const PRIMITIVE = new Set(["string", "number", "integer", "boolean"]);

/**
 * Drop JSON Schema noise models don't need: the repeated $schema, minLength 1,
 * length caps no sane value reaches, and anyOf [{type: X}, {type: null}]
 * spelled as type [X, "null"].
 */
export function leanSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(leanSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "$schema") continue;
    if (k === "minLength" && v === 1) continue;
    if (k === "maxLength" && typeof v === "number" && v >= 100) continue;
    out[k] = leanSchema(v);
  }
  const any = out.anyOf as Record<string, unknown>[] | undefined;
  if (any?.length === 2 && any[1]?.type === "null" && Object.keys(any[1]).length === 1 && PRIMITIVE.has(any[0]?.type as string)) {
    const { anyOf: _, ...rest } = out;
    void _;
    return { ...any[0], ...rest, type: [any[0].type, "null"] };
  }
  return out;
}

type ToolDef = { inputSchema?: unknown; annotations?: Record<string, unknown>; execution?: { taskSupport?: string } };

/**
 * tools/list is sent to the model on every conversation, so trim the SDK's
 * output: no per-tool $schema, no default-valued annotations (readOnlyHint
 * false, taskSupport forbidden), no length caps a model never hits. Inputs
 * are still validated against the full zod schemas.
 */
export function leanToolList(server: McpServer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers: Map<string, (...args: any[]) => Promise<{ tools: ToolDef[] }>> | undefined = (server.server as any)._requestHandlers;
  const original = handlers?.get("tools/list");
  if (!handlers || !original) return;
  handlers.set("tools/list", async (...args) => {
    const result = await original(...args);
    return {
      ...result,
      tools: result.tools.map((t) => {
        const { execution, annotations, ...rest } = t;
        const tool: ToolDef = { ...rest, inputSchema: leanSchema(t.inputSchema) };
        if (execution && execution.taskSupport !== "forbidden") tool.execution = execution;
        if (annotations) {
          const a = { ...annotations };
          if (a.readOnlyHint === false) delete a.readOnlyHint;
          if (a.readOnlyHint) delete a.destructiveHint; // only meaningful for writes
          if (Object.keys(a).length) tool.annotations = a;
        }
        return tool;
      }),
    };
  });
}
