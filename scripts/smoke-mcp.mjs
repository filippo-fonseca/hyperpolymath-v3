#!/usr/bin/env node
// End-to-end smoke test of the MCP endpoint, acting as a bot.
//
//   HPM_TOKEN=hpm_... node scripts/smoke-mcp.mjs [base-url]
//
// Creates a task with a reminder, completes it, reverts the completion, and
// cleans up after itself (deletes the task). Prints each step.

const base = process.argv[2] ?? "http://localhost:3000";
const token = process.env.HPM_TOKEN;
if (!token) {
  console.error("Set HPM_TOKEN to an MCP token (Settings > MCP tokens).");
  process.exit(1);
}

let id = 0;
async function rpc(method, params) {
  const res = await fetch(`${base}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function call(name, args) {
  const r = await rpc("tools/call", { name, arguments: { bot: "Smoke Test", ...args } });
  const text = r.content?.[0]?.text ?? "";
  if (r.isError) throw new Error(`${name}: ${text}`);
  return JSON.parse(text);
}

const step = (s) => console.log(`- ${s}`);

await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0" },
});
const { tools } = await rpc("tools/list", {});
step(`${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);

const overview = await call("get_overview", {});
step(`overview ok (now ${overview.now}, ${overview.tasks_due_today_or_overdue.length} due)`);

const created = await call("create_task", {
  title: "Smoke test: do the laundry",
  due_date: overview.now.slice(0, 10),
  reminder: { schedule: { type: "interval", every_minutes: 180, window: { start: "09:00", end: "22:00" } } },
});
step(`created task ${created.task.id}; reminder ${created.reminder.describes}, first at ${created.reminder.first_fire_at}`);

const done = await call("complete_task", { id: created.task.id });
step(`completed: status=${done.status}`);

const actions = await call("list_actions", { bot_name: "Smoke Test", limit: 5 });
const completion = actions.find((a) => a.summary.startsWith("Completed"));
await call("revert_action", { id: completion.id });
const list = await call("list_tasks", { query: "Smoke test: do the laundry", scope: "all" });
step(`reverted completion: status=${list[0]?.status}`);

await call("delete_task", { id: created.task.id });
await call("archive_bot", { name: "Smoke Test" });
step("cleaned up (task deleted, Smoke Test bot archived)");
console.log("Smoke test passed.");
