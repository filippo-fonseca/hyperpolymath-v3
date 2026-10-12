const STEPS = [
  {
    title: "Tell Kiwi in plain words.",
    body: "In Grok Bot's chat, by voice or from your phone. No forms, no syntax.",
  },
  {
    title: "The team acts through MCP.",
    body: "Kiwi and its teammates call Hyperpolymath's MCP tools, filing each thing under the right project.",
  },
  {
    title: "The screen updates at once.",
    body: "Every change, yours or a bot's, lands in an activity log with a Revert button.",
  },
  {
    title: "It comes back when it matters.",
    body: "Reminders return through Kiwi until they're done, and routines publish to widgets only when there's something new.",
  },
];

export function Steps() {
  return (
    <ol className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((s, i) => (
        <li key={s.title} className="border-t border-ink/10 pt-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-ink text-[12px] font-semibold tabular-nums">
            {i + 1}
          </span>
          <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.01em]">{s.title}</h3>
          <p className="mt-1.5 text-pretty text-[14px] leading-relaxed text-ink-2">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
