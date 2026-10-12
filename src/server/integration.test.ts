// Integration tests against a real Supabase project. They run only when
// SUPABASE_SECRET_KEY is available (e.g. from .env.local) and use a throwaway
// user that is deleted afterwards (all rows cascade).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminDb, type Ctx } from "./ctx";
import { resolveBotActor } from "./bots";
import { completeTask, createTask, getTask, listTasks, updateTask } from "./tasks";
import { listActions, revertAction } from "./log";
import { setReminder } from "./reminders";
import { createHabit, listHabits, logHabit } from "./habits";
import { convertCaptureToTask, createCapture } from "./captures";
import { createWidget, publishWidget, widgetHistory } from "./widgets";
import { getOverview } from "./overview";
import { runTick } from "./tick";
import { mintToken } from "./tokens";
import { createArea, createProject, listAreas, updateProject } from "./projects";
import { finishRun, listRoutines, registerRoutine, startRun, updateRoutine } from "./routines";
import { zonedToUtc } from "@/lib/time";

const enabled = !!(process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
const TZ = "America/New_York";

describe.skipIf(!enabled)("service layer (live DB)", () => {
  let userId = "";
  const ctxAt = (now: Date, actor: Ctx["actor"] = { kind: "user", name: "you" }): Ctx => ({
    db: adminDb(),
    userId,
    actor,
    tz: TZ,
    now,
  });
  const NOON = zonedToUtc("2026-10-12", "12:00", TZ);

  beforeAll(async () => {
    const { data, error } = await adminDb().auth.admin.createUser({
      email: `it-${randomUUID()}@example.com`,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId) await adminDb().auth.admin.deleteUser(userId);
  });

  it("creates, completes and reverts a task, attributing the bot", async () => {
    const actor = await resolveBotActor(adminDb(), userId, "Kiwi");
    const ctx = ctxAt(NOON, actor);
    const t = await createTask(ctx, { title: "Laundry", due_date: "2026-10-12" });
    const done = await completeTask(ctx, t.id);
    expect(done.status).toBe("done");

    const actions = await listActions(ctx, { botId: actor.kind === "bot" ? actor.botId : undefined });
    expect(actions.map((a) => a.tool)).toEqual(["complete_task", "create_task"]);

    await revertAction(ctx, actions[0].id);
    expect((await getTask(ctx, t.id)).status).toBe("todo");
    await expect(revertAction(ctx, actions[0].id)).rejects.toThrow(/already reverted/);
  });

  it("refuses a stale revert unless forced", async () => {
    const ctx = ctxAt(NOON);
    const t = await createTask(ctx, { title: "Stale" });
    await updateTask(ctx, t.id, { priority: 3 });
    const [first] = await listActions(ctx, { limit: 1 });
    await new Promise((r) => setTimeout(r, 20));
    await updateTask(ctx, t.id, { title: "Stale, edited" });
    await expect(revertAction(ctx, first.id)).rejects.toThrow(/changed after/);
    await revertAction(ctx, first.id, true);
    expect((await getTask(ctx, t.id)).priority).toBe(0);
  });

  it("rolls recurring tasks forward instead of closing them", async () => {
    const ctx = ctxAt(NOON);
    const t = await createTask(ctx, { title: "Water plants", due_date: "2026-10-12", recurrence: { freq: "daily", interval: 2 } });
    const next = await completeTask(ctx, t.id);
    expect(next.status).toBe("todo");
    expect(next.due_date).toBe("2026-10-14");
  });

  it("tick relays due until-done reminders and retires them once the task is done", async () => {
    const ctx = ctxAt(zonedToUtc("2026-10-12", "09:30", TZ));
    const t = await createTask(ctx, { title: "Call the bank" });
    const r = await setReminder(ctx, { task_id: t.id, schedule: { type: "daily", times: ["10:00"] } });
    expect(r.first_fire_at).toBe(zonedToUtc("2026-10-12", "10:00", TZ).toISOString());

    const sent: string[] = [];
    const deliver = async (_u: string, batch: { text: string }[]) => {
      sent.push(...batch.map((b) => b.text));
    };
    await runTick(zonedToUtc("2026-10-12", "10:01", TZ), deliver, { userId });
    expect(sent).toContain("Call the bank");
    const { data: after } = await adminDb().from("reminders").select().eq("id", r.id).single();
    expect(after!.next_fire_at).toBe(zonedToUtc("2026-10-13", "10:00", TZ).toISOString());

    // A failed delivery rolls back so the next tick retries.
    await runTick(
      zonedToUtc("2026-10-13", "10:01", TZ),
      async () => {
        throw new Error("webhook down");
      },
      { userId },
    );
    const { data: failed } = await adminDb().from("reminders").select().eq("id", r.id).single();
    expect(failed!.next_fire_at).toBe(zonedToUtc("2026-10-13", "10:00", TZ).toISOString());
    expect(failed!.last_error).toMatch(/webhook down/);

    await completeTask(ctx, t.id);
    sent.length = 0;
    await runTick(zonedToUtc("2026-10-13", "10:05", TZ), deliver, { userId });
    expect(sent).not.toContain("Call the bank");
    const { data: retired } = await adminDb().from("reminders").select().eq("id", r.id).single();
    expect(retired!.active).toBe(false);
  });

  it("tracks habit progress and streaks", async () => {
    const ctx = ctxAt(NOON);
    await createHabit(ctx, { name: "Read", days_of_week: [0, 1, 2, 3, 4, 5, 6] });
    await logHabit(ctx, "read", { date: "2026-10-11" });
    await logHabit(ctx, "Read", { progress: 2 });
    const [h] = await listHabits(ctx);
    expect(h.today_progress).toBe(2);
    expect(h.streak).toBe(1);
  });

  it("converts captures into tasks", async () => {
    const ctx = ctxAt(NOON);
    const c = await createCapture(ctx, { content: "Book dentist\nsee https://example.com/dentist" });
    expect(c.urls).toEqual(["https://example.com/dentist"]);
    const task = await convertCaptureToTask(ctx, c.id);
    expect(task.title).toBe("Book dentist");
    const open = await listTasks(ctx, { scope: "inbox" });
    expect(open.some((x) => x.id === task.id)).toBe(true);
  });

  it("validates widget payloads and keeps history", async () => {
    const actor = await resolveBotActor(adminDb(), userId, "Slack Roundup");
    const ctx = ctxAt(NOON, actor);
    const w = await createWidget(ctx, { kind: "digest", title: "Slack", stale_after_hours: 26 });
    await expect(publishWidget(ctx, "Slack", { nope: true })).rejects.toThrow(/doesn't match/);
    await publishWidget(ctx, "slack", { sections: [{ title: "#general", items: [{ text: "Standup moved" }] }] });
    await publishWidget(ctx, w.id, { summary: "Quiet night", sections: [] });
    expect(await widgetHistory(ctx, w.id)).toHaveLength(2);
    // Republishing identical content stays quiet: no new history.
    const again = await publishWidget(ctx, w.id, { sections: [], summary: "Quiet night" });
    expect(again.changed).toBe(false);
    expect(await widgetHistory(ctx, w.id)).toHaveLength(2);
  });

  it("routines: register, pause from the app, and runs respect it", async () => {
    const actor = await resolveBotActor(adminDb(), userId, "Slack Roundup");
    const bot = ctxAt(NOON, actor);
    await registerRoutine(bot, { name: "Nightly scan", schedule: "weeknights at 10pm" });
    await registerRoutine(bot, { name: "nightly scan", description: "Missed messages" }); // upsert by name
    const [r] = await listRoutines(bot);
    expect(r.description).toBe("Missed messages");

    const run = await startRun(bot, "Nightly scan");
    expect(run.enabled).toBe(true);
    await finishRun(bot, run.run_id!, { summary: "3 missed threads" });

    await updateRoutine(ctxAt(NOON), r.id, { enabled: false }); // owner pauses it in the app
    const skipped = await startRun(bot, "Nightly scan");
    expect(skipped.enabled).toBe(false);
    const [after] = await listRoutines(bot);
    expect(after.run_count).toBe(1);
    expect(after.last_status).toBe("skipped");
  });

  it("areas group projects, and tasks file under them", async () => {
    const ctx = ctxAt(NOON);
    await createArea(ctx, { name: "School", emoji: "🎓" });
    await createProject(ctx, { name: "Machine Elements", area: "school", is_class: true, course_code: "MENG 2050" });
    const t = await createTask(ctx, { title: "Waterjet photos", project: "machine elements" });
    expect(t.project_id).toBeTruthy();
    expect((await listTasks(ctx, { area: "School", scope: "open" })).map((x) => x.id)).toContain(t.id);
    await updateProject(ctx, "Machine Elements", { status: "done" });
    const { areas } = await listAreas(ctx);
    const school = areas.find((a) => a.name === "School")!;
    expect(school.projects[0]).toMatchObject({ status: "done", open_tasks: 1 });
  });

  it("routines are inferred from widget publishes and adopted on register", async () => {
    const actor = await resolveBotActor(adminDb(), userId, "Shopper");
    const bot = ctxAt(NOON, actor);
    await createWidget(bot, { kind: "list", title: "Groceries" });
    await publishWidget(bot, "Groceries", { items: [{ text: "Milk" }] });
    let mine = (await listRoutines(bot)).filter((r) => r.widget_id);
    const inferred = mine.find((r) => r.name === "Groceries")!;
    expect(inferred.source).toBe("inferred");
    expect(inferred.run_count).toBe(1);

    await registerRoutine(bot, { name: "Weekly grocery run", schedule: "Sundays 9am", widget: "Groceries" });
    mine = (await listRoutines(bot)).filter((r) => r.widget_id === inferred.widget_id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: "Weekly grocery run", source: "registered" });

    const run = await startRun(bot, "Brand new routine"); // unknown routine auto-registers
    expect(run.enabled).toBe(true);
  });

  it("overview grounds a bot in one call", async () => {
    const o = await getOverview(ctxAt(NOON));
    expect(o.timezone).toBe(TZ);
    expect(Array.isArray(o.tasks_due_today_or_overdue)).toBe(true);
    expect(o.calendar_today_and_tomorrow.connected).toBe(false);
  });

  it("serves MCP over HTTP with a bearer token", async () => {
    const { token } = await mintToken(adminDb(), userId, "test");
    const { POST } = await import("@/app/api/mcp/route");
    const rpc = (body: unknown, auth = `Bearer ${token}`) =>
      POST(
        new Request("http://localhost/api/mcp", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: auth },
          body: JSON.stringify(body),
        }),
      );
    expect((await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "Bearer hpm_wrong")).status).toBe(401);

    const init = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "it", version: "0" } },
    });
    expect(init.status).toBe(200);
    const list = await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json();
    const names = list.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(expect.arrayContaining(["get_overview", "create_task", "complete_task", "set_reminder", "publish_widget", "create_event", "revert_action"]));

    const call = await (
      await rpc({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "create_task", arguments: { bot: "Kiwi", title: "From MCP" } },
      })
    ).json();
    expect(call.result.isError).toBeFalsy();
    expect(JSON.parse(call.result.content[0].text).created_by).toBe("Kiwi");
  });
});
