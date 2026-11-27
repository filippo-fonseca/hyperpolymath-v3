import type { OverviewInput } from "@/server/overview";

// A realistic, entirely made-up mid-semester day, used to budget the size of
// get_overview. No real data.
// Deterministic but random-looking uuids, so token counts match real ids.
const hex = (n: number, len: number) => {
  let x = (n + 1) * 2654435761;
  let out = "";
  while (out.length < len) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out += x.toString(16).padStart(8, "0");
  }
  return out.slice(0, len);
};
const id = (n: number) => `${hex(n, 8)}-${hex(n + 1, 4)}-4${hex(n + 2, 3)}-a${hex(n + 3, 3)}-${hex(n + 4, 12)}`;
const ts = (d: string, t: string) => `${d}T${t}:22.512341+00:00`;

const projects = [
  ["Thermodynamics", "School"],
  ["Signals and Systems", "School"],
  ["Machine Elements", "School"],
  ["Research lab", "Work"],
  ["Half Ironman", "Health"],
  ["Strength block", "Health"],
  ["Trip planning", "Life"],
  ["Apartment", "Life"],
  ["Side project", "Work"],
].map(([name, area], i) => ({ id: id(100 + i), name, area, status: i === 8 ? "paused" : "active", open_tasks: (i * 3) % 7 }));

const areaNames = ["School", "Work", "Health", "Life"];
const areas = {
  areas: areaNames.map((a, i) => ({
    id: id(90 + i),
    name: a,
    emoji: ["🎓", "🔬", "🏃", "🏠"][i],
    projects: projects.filter((p) => p.area === a),
  })),
  unsorted: [],
};

const titles = [
  "Problem set 7",
  "Read chapter 9 and annotate",
  "Email TA about regrade",
  "Lab notebook writeup",
  "Long ride, zone 2",
  "Book flights for winter break",
  "Renew renter's insurance",
  "Office hours prep questions",
  "Gear train design review",
  "Push bench day",
  "Fix laptop battery",
  "Draft abstract for symposium",
];
const task = (n: number, due: string | null, extra: Record<string, unknown> = {}) => ({
  id: id(n),
  user_id: id(1),
  title: titles[n % titles.length],
  notes: null,
  status: n % 5 === 0 ? "doing" : "todo",
  priority: n % 4,
  project_id: n % 3 === 0 ? null : projects[n % projects.length].id,
  due_date: due,
  due_time: due && n % 2 ? "17:00:00" : null,
  recurrence: n % 6 === 0 ? { freq: "weekly", interval: 1 } : null,
  created_at: ts("2026-11-20", "10:00"),
  updated_at: ts("2026-11-26", "10:00"),
  deleted_at: null,
  ...extra,
});

export const overviewFixture = {
  today: Array.from({ length: 12 }, (_, i) => task(i, i < 3 ? "2026-11-25" : "2026-11-27")),
  inbox: Array.from({ length: 8 }, (_, i) => task(20 + i, null)),
  habits: ["Meditate", "Run", "Read 20 pages", "Stretch", "No phone after 11", "Journal"].map((name, i) => ({
    id: id(200 + i),
    name,
    scheduled_today: i !== 4,
    today_progress: i % 4,
    streak: i * 2,
  })),
  captures: Array.from({ length: 8 }, (_, i) => ({
    id: id(300 + i),
    content:
      "Idea: a small model that predicts arrhythmia risk from wearable HRV, trained on public datasets; check whether the lab's sensor rig can stream raw RR intervals at 250 Hz. ".slice(0, 60 + i * 20),
    source: i % 2 ? "mcp" : "app",
    created_at: ts("2026-11-2" + (i % 7), "09:15"),
    comment_count: i % 3,
  })),
  resurfaced: Array.from({ length: 2 }, (_, i) => ({
    id: id(400 + i),
    content: "Revisit: reading list for control theory over winter break, start with Astrom and Murray.",
    resurfaced_at: ts("2026-11-27", "09:00"),
    resurface_schedule: { type: "daily", times: ["09:00"], days: [1] },
    comment_count: 0,
  })),
  reminders: Array.from({ length: 6 }, (_, i) => ({
    id: id(500 + i),
    task: i < 4 ? { id: id(i), title: titles[i], status: "todo" } : null,
    message: i < 4 ? null : "Drink water",
    next_fire_at: ts("2026-11-27", "1" + i + ":00"),
    until_kind: i < 4 ? "done" : "count",
  })),
  widgets: ["Slack roundup", "Canvas due dates", "Training load", "Inbox zero", "Lab queue", "Weather", "Reading"].map((title, i) => ({
    title,
    kind: ["digest", "list", "stat", "stat", "table", "markdown", "list"][i],
    owner: i < 5 ? { name: ["Kiwi", "Scout", "Coach"][i % 3] } : null,
    published_at: ts("2026-11-27", "0" + i + ":30"),
  })),
  calendar: {
    connected: true,
    events: [
      { id: "evt1", title: "Thermo lecture", when: "today 09:00 to 10:15", location: "Room 211" },
      { id: "evt2", title: "Lab meeting", when: "today 13:00 to 14:00", location: null },
      { id: "evt3", title: "Swim", when: "today 18:00 to 19:00", location: "Pool" },
      { id: "evt4", title: "Signals lecture", when: "tomorrow 11:35 to 12:50", location: "Hall B" },
    ],
  },
  areas,
} as unknown as OverviewInput;
