import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppError, makeCtx, type Ctx } from "./ctx";
import { archiveBot, renameBot, resolveBotActor, listBots, setCoordinator, updateBot } from "./bots";
import { getOverview } from "./overview";
import { completeTask, createTask, deleteTask, listTasks, reopenTask, updateTask } from "./tasks";
import { cancelReminder, listReminders, setReminder, snoozeReminder } from "./reminders";
import { createHabit, listHabits, logHabit, updateHabit } from "./habits";
import { convertCaptureToTask, createCapture, listCaptures, updateCapture } from "./captures";
import { createWidget, listWidgets, publishWidget, removeWidget, updateWidget } from "./widgets";
import { listActions, revertAction } from "./log";
import { setTimezone } from "./settings";
import { createArea, createProject, deleteProject, getProject, listAreas, updateArea, updateProject } from "./projects";
import { finishRun, listRoutines, registerRoutine, removeRoutine, startRun, updateRoutine } from "./routines";
import { createEvent, deleteEvent, listCalendars, listEvents, updateEvent } from "./google/calendar";
import { scheduleSchema } from "@/lib/schedule";
import { recurrenceSchema } from "@/lib/recurrence";
import { CUSTOM_KINDS, PAYLOAD_DOCS } from "@/lib/widgets";
import { isLocalDate, isLocalTime } from "@/lib/time";

const BASE_INSTRUCTIONS = `Hyperpolymath is the owner's life dashboard. This server is the single source of truth for their tasks, reminders, habits, quick captures and dashboard widgets.

Voice (Kiwi, the coordinator, only; other bots keep their own voices):
- Kiwi is a British butler in the manner of J.A.R.V.I.S.: composed, precise, quietly capable, with dry, understated wit. Address the owner as "sir".
- Wit is seasoning, not the meal: at most one light touch in a message, and none at all when the news is bad, urgent, or the owner is stressed. Never forced, never a pun for its own sake, never sycophantic or theatrical. Clarity and brevity first.
- Examples of the register: "Added to Machine Elements, sir." / "Your 3pm has moved to four. I took the liberty of keeping the reminder with it." / "Nothing new in Slack tonight, sir. A rare peace." / "That deadline is tomorrow at 11:59pm, sir. I would not leave it to the last minute."

Rules:
- Start every conversation that touches their tasks, habits or day with get_overview. Never answer from memory: state changes in the app at any time.
- Every tool takes \`bot\`: your own bot name (e.g. "Kiwi"). It attributes your actions in the activity log, where the owner can review and revert them.
- When the owner says something is done ("finished laundry"), find the task (get_overview or list_tasks with query) and call complete_task. If nothing matches, ask before creating one.
- Reminders live HERE, not in Grok Bot routines. Anything of the form "remind me / nudge me / press me ... at X / every Y / until Z" becomes a task (if there is a thing to do) plus set_reminder. Hyperpolymath delivers due reminders to the coordinator through one "Reminder relay" webhook routine, so never create a separate Grok Bot routine just to remind the owner. Translate their words into the structured schedule: "until I say it's done" = until "done" on a task (stops when the task completes); "until Friday" = until "date"; "three times" = until "count". Times are local to their timezone (see get_overview), 24h HH:MM.
- Grok Bot routines are for WORK a bot does on a schedule (scan Slack, write a digest, check a website, draft emails). They stay in Grok Bot and may read or write Hyperpolymath through these tools. If a routine only exists to remind the owner of something, migrate it to set_reminder and offer to delete the routine.
- Quiet by default: on scheduled runs, only message the owner when the run produced something new or useful (a new message to answer, a change, a decision they need to make, an error they must fix). If nothing changed, say nothing to them: just finish_routine_run with a short summary like "nothing new". This applies to every bot. Reminder relay runs always message (that's their job).
- Register every routine you run with register_routine (name, schedule in words, what it does, its widget if it publishes one) so it shows in the app. At the START of every run call start_routine_run: if it returns enabled=false the owner paused it in the app, so stop immediately. At the END call finish_routine_run with status and a one-line summary. When you change or delete a routine in Grok Bot, mirror it with update_routine / remove_routine.
- Quick thoughts, links and ideas without a clear action go to create_capture, not tasks.
- Projects: the owner organises life into areas (School, Health, Work...) holding projects (classes are projects too). Tasks and captures can belong to one project; habits to an area. Know the current projects (get_overview lists active ones per area; list_areas has all).
  - When the owner gives you a task or capture, file it under a project ONLY if it clearly fits one (same class, same initiative, obvious keyword or context). Don't force it: if nothing fits well, or two projects fit equally, leave it unfiled (it stays in the inbox) rather than guessing. Never create a new project just to file one item unless they ask.
  - Always confirm where it went, briefly: "Added to Machine Elements." or "Added, not filed under a project." The tool result's filed_under field tells you. They can say "move it to X" (update_task project) or "undo" (revert_action).
  - Keep project status current as things move on (update_project status: active, paused, done).
- Dates: use the "now" and timezone from get_overview, never your own clock. After creating or moving something, tell the owner the date in words ("for tomorrow, Mon Oct 12") so a wrong guess is caught. If they gave no date, leave due_date empty (it lands in the inbox) rather than guessing.
- Calendar: use the calendar tools here (not a separate Google Calendar connector) so changes are logged and revertible. Event ids come from list_events. Never invite other people unless asked.
- Widgets: only create or publish a widget when the owner asked for that routine to appear on the dashboard. Publish the full current content each run (it replaces the previous version, history is kept).
- Ask before deleting anything. Mistakes can be undone with revert_action, so own them and revert.
- When you create a sub-bot in Grok Bot, call update_bot with its name, role and parent (your name) so it appears in the teammates view.`;

const bot = z.string().min(1).max(60).describe('Your bot name, e.g. "Kiwi". Required on every call.');
const date = z.string().refine(isLocalDate, "YYYY-MM-DD").describe("Local date YYYY-MM-DD");
const time = z.string().refine(isLocalTime, "HH:MM").describe("Local time HH:MM (24h)");
const uuid = z.string().uuid();

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
    'When to nudge. Examples: {"type":"daily","times":["10:00"]}; {"type":"interval","every_minutes":180,"window":{"start":"09:00","end":"22:00"}}; {"type":"once","date":"2026-10-12","time":"15:00"}; {"type":"daily","times":["09:00"],"days":[1,3,5]}',
  ),
  until: z
    .enum(["done", "date", "count", "once"])
    .optional()
    .describe('"done" (default for tasks): keep nudging until the task is completed. "date": stop after until_date. "count": stop after count nudges. "once": fire once.'),
  until_date: date.optional(),
  count: z.number().int().min(1).max(500).optional(),
};

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

function ok(data: Json) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }] };
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

/** Instructions with the owner's chosen name for the main assistant. */
function instructions(coordinator: string | null) {
  const name = coordinator ?? "Kiwi";
  const text = name === "Kiwi" ? BASE_INSTRUCTIONS : BASE_INSTRUCTIONS.replaceAll("Kiwi", name);
  return `${text}
- Names: the main assistant (coordinator) is currently "${name}". If a bot's name in Grok Bot no longer matches the name it is registered under here (see list_bots), call rename_bot once with the old and new names before anything else, so its history carries over instead of a new bot appearing.`;
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
  tool("get_overview", "Today's tasks and overdue items, inbox, habits, captures, reminders and widgets in one call. Call this first.", {}, (ctx) => getOverview(ctx), { readOnly: true });

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
    { id: uuid, minutes: z.number().int().min(5).max(60 * 24 * 14).optional(), until: z.string().datetime({ offset: true }).optional() },
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
    "Save a quick thought, link or idea. resurface_at brings it back on a date.",
    { content: z.string().min(1).max(20000), resurface_at: date.optional(), project: z.string().max(120).optional() },
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
    "Edit, archive or reschedule resurfacing of a capture.",
    { id: uuid, content: z.string().min(1).max(20000).optional(), resurface_at: date.nullable().optional(), archived: z.boolean().optional(), project: z.string().max(120).nullable().optional() },
    (ctx, { id, ...patch }) => updateCapture(ctx, id, patch),
  );
  tool(
    "convert_capture_to_task",
    "Turn a capture into a task (archives the capture).",
    { id: uuid, title: z.string().max(500).optional(), due_date: date.optional(), priority: z.number().int().min(0).max(3).optional(), project: z.string().max(120).optional() },
    (ctx, { id, ...task }) => convertCaptureToTask(ctx, id, task),
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
    "Create a life area (e.g. School, Health, Work, Relationships).",
    { name: z.string().min(1).max(80), emoji: z.string().max(8).optional(), color: z.string().max(20).optional() },
    (ctx, a) => createArea(ctx, a),
  );
  tool(
    "update_area",
    "Rename, re-emoji or archive an area.",
    { area: z.string().min(1).max(80), name: z.string().max(80).optional(), emoji: z.string().max(8).nullable().optional(), color: z.string().max(20).nullable().optional(), archived: z.boolean().optional() },
    (ctx, { area, ...patch }) => updateArea(ctx, area, patch),
  );
  tool("get_project", "A project with its tasks and recent captures.", { project: z.string().min(1).max(120) }, (ctx, a) => getProject(ctx, a.project), { readOnly: true });
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
      size: z.enum(["s", "m", "l"]).optional().describe("s = 1x1, m = 2x1, l = 2x2"),
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
    "Register (or update by name) a Grok Bot routine you run, so the owner sees and controls it in Hyperpolymath. Owner defaults to you.",
    {
      name: z.string().min(1).max(120),
      schedule: z.string().max(200).optional().describe('In words, e.g. "weeknights at 10pm"'),
      description: z.string().max(2000).optional(),
      widget: z.string().max(120).optional().describe("Title or id of the widget this routine publishes to"),
      grokbot_routine_id: z.string().max(200).optional(),
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
  tool("remove_routine", "Remove a routine from Hyperpolymath (after deleting it in Grok Bot).", { routine: z.string().min(1).max(120) }, (ctx, a) => removeRoutine(ctx, a.routine), { destructive: true });
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
    "Rename a registered bot (e.g. after it was renamed in Grok Bot). Keeps its history, routines and widgets.",
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

  return server;
}
