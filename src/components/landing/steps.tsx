const STEPS = [
  {
    title: "You message Kiwi",
    body: "Type or talk to it in Grok Bot, on your laptop or your phone. \u201cfinished laundry\u201d is a complete instruction.",
  },
  {
    title: "A bot calls the MCP tools",
    body: "Kiwi, or whichever bot owns the job, calls Hyperpolymath's tools to add the task or move the event, and files it under a project if one fits.",
  },
  {
    title: "The dashboard updates",
    body: "Usually within a second. The change also goes into the activity log with a Revert button, whether you made it or a bot did.",
  },
  {
    title: "Kiwi nags you",
    body: "The app checks for due reminders every five minutes and Kiwi messages you. Reply \u201cdone\u201d and they stop.",
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
