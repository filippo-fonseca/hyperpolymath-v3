import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpServer, leanJson, leanSchema } from "./mcp";
import { shapeOverview } from "./overview";
import { overviewFixture } from "@/test/overview-fixture";

/**
 * Every connected client pays for the server instructions and the tools/list
 * payload at the start of every conversation, and for get_overview in most of
 * them, so they are budgeted like bundle size. Raise a budget deliberately,
 * never by accident. Set MCP_MEASURE_OUT=path.json to dump the payloads for
 * token counting.
 */
const BUDGET = {
  instructionsChars: 3_000,
  toolsListChars: 34_000,
  overviewChars: 8_000,
};

async function snapshot(coordinator: string | null = null) {
  const server = buildMcpServer("00000000-0000-0000-0000-000000000000", coordinator);
  const client = new Client({ name: "budget", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const instructions = client.getInstructions() ?? "";
  const { tools } = await client.listTools();
  await client.close();
  return { instructions, tools };
}

describe("MCP context budget", () => {
  it("keeps instructions and tools/list within budget", async () => {
    const s = await snapshot();
    const toolsJson = JSON.stringify(s.tools);
    if (process.env.MCP_MEASURE_OUT) writeFileSync(process.env.MCP_MEASURE_OUT, JSON.stringify(s));
    expect(s.instructions.length).toBeLessThan(BUDGET.instructionsChars);
    expect(toolsJson.length).toBeLessThan(BUDGET.toolsListChars);
  });

  it("serves lean tool schemas that still list every tool", async () => {
    const { tools } = await snapshot();
    const json = JSON.stringify(tools);
    expect(tools.length).toBeGreaterThan(40);
    expect(json).not.toContain("$schema");
    expect(json).not.toContain('"pattern"'); // no zod uuid/datetime regexes
    expect(json).not.toContain("taskSupport");
    const complete = tools.find((t) => t.name === "complete_task")!;
    expect(complete.inputSchema.required).toEqual(["bot", "id"]);
    expect(complete.annotations).toEqual({ destructiveHint: false });
    expect(tools.find((t) => t.name === "get_overview")!.annotations).toEqual({ readOnlyHint: true });
    expect(tools.find((t) => t.name === "delete_task")!.annotations).toEqual({ destructiveHint: true });
  });

  it("keeps instructions client-neutral and names the coordinator", async () => {
    const neutral = await snapshot();
    expect(neutral.instructions).not.toMatch(/Kiwi|Grok|butler|sir\b/);
    expect(neutral.instructions).toMatch(/No coordinator yet/);
    const named = await snapshot("Jeeves");
    expect(named.instructions).toMatch(/coordinator\) is "Jeeves"/);
  });

  it("still validates ids and datetimes strictly", async () => {
    const server = buildMcpServer("00000000-0000-0000-0000-000000000000");
    const client = new Client({ name: "budget", version: "0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    const bad = await client.callTool({ name: "complete_task", arguments: { bot: "Test", id: "not-a-uuid" } });
    expect(bad.isError).toBe(true);
    expect(JSON.stringify(bad.content)).toMatch(/uuid/);
    const badTime = await client.callTool({
      name: "snooze_reminder",
      arguments: { bot: "Test", id: "123e4567-e89b-42d3-a456-426614174000", until: "tomorrow" },
    });
    expect(badTime.isError).toBe(true);
    expect(JSON.stringify(badTime.content)).toMatch(/ISO datetime/);
    await client.close();
  });
});

describe("leanSchema", () => {
  it("folds nullable primitives and drops noise", () => {
    expect(
      leanSchema({
        $schema: "x",
        type: "object",
        properties: {
          a: { anyOf: [{ type: "string", maxLength: 120, description: "inner" }, { type: "null" }], description: "outer" },
          b: { type: "string", minLength: 1, maxLength: 60 },
          c: { anyOf: [{ type: "object", properties: {} }, { type: "null" }] },
        },
      }),
    ).toEqual({
      type: "object",
      properties: {
        a: { type: ["string", "null"], description: "outer" },
        b: { type: "string", maxLength: 60 },
        c: { anyOf: [{ type: "object", properties: {} }, { type: "null" }] },
      },
    });
  });
});

describe("leanJson", () => {
  it("drops nulls and bookkeeping but keeps filed_under and array slots", () => {
    const out = JSON.parse(
      leanJson({ id: "t", user_id: "u", notes: null, deleted_at: null, filed_under: null, rows: [[1, null]], nested: { x: null, y: 0 } }),
    );
    expect(out).toEqual({ id: "t", filed_under: null, rows: [[1, null]], nested: { y: 0 } });
  });
});

describe("get_overview budget", () => {
  const out = shapeOverview(overviewFixture, { now: new Date("2026-11-27T15:00:00Z"), tz: "America/New_York" });

  it("stays within budget on a busy day", () => {
    const lean = leanJson(out);
    if (process.env.MCP_MEASURE_OUT) writeFileSync(process.env.MCP_MEASURE_OUT.replace(/\.json$/, "-overview.json"), JSON.stringify({ lean }));
    expect(lean.length).toBeLessThan(BUDGET.overviewChars);
  });

  it("uses local times and omits defaults", () => {
    expect(out.now).toBe("2026-11-27 10:00");
    expect(out.active_reminders[0].next_fire_at).toBe("2026-11-27 05:00");
    const first = out.tasks_due_today_or_overdue[0];
    expect(first.overdue).toBe(true);
    const plain = out.tasks_due_today_or_overdue.find((t) => t.due === "2026-11-27" && !t.recurring && !t.status)!;
    expect(plain.priority === undefined || plain.priority > 0).toBe(true);
    expect(plain.overdue).toBeUndefined();
    expect(out.areas_and_active_projects[0].projects[0]).toEqual({ name: "Thermodynamics", open_tasks: 0 });
  });
});
