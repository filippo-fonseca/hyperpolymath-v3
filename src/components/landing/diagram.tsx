import type { CSSProperties, ReactNode } from "react";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { IconCheck, IconClock } from "@/components/ui/icons";

// "How Grok Bot is leveraged": You <-> Kiwi and its sub-bots (in Grok Bot)
// <-> the Hyperpolymath MCP server <-> the live dashboard. Plain HTML boxes in
// a Notion-style black line drawing, with the accent blue reserved for the
// dot that travels the connectors. Stacks vertically below `lg`.

const box = "relative rounded-[18px] border-[1.5px] border-ink bg-surface";

export function Diagram() {
  return (
    <figure className="mx-auto w-full max-w-[420px] lg:max-w-none" aria-label="How a message flows from you to the dashboard">
      <div className="flex flex-col items-stretch lg:grid lg:grid-cols-[minmax(0,0.78fr)_68px_minmax(0,1.5fr)_68px_minmax(0,1.2fr)_68px_minmax(0,0.95fr)] lg:items-center">
        <YouNode />
        <Connector label="Plain words" index={0} />
        <GrokBotNode />
        <Connector label="MCP tools" index={1} />
        <McpNode />
        <Connector label="Realtime" index={2} />
        <DashboardNode />
      </div>
    </figure>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{children}</p>;
}

function YouNode() {
  return (
    <div className={`${box} flex items-center gap-3.5 p-4 lg:flex-col lg:items-start lg:gap-3 lg:p-5`}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0" aria-hidden>
        <circle cx="18" cy="18" r="16.5" />
        <circle cx="18" cy="14.5" r="5" />
        <path d="M8.6 29.2c1.9-4.6 5.4-7 9.4-7s7.5 2.4 9.4 7" strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-[15px] font-semibold">You</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">Type or talk to Kiwi, on any device.</p>
      </div>
    </div>
  );
}

const SUB_BOTS = [
  {
    name: "Slack Roundup",
    when: "Nightly, 22:00",
    d: "M20 4c11.5 0 16 4.5 16 16s-4.5 16-16 16S4 31.5 4 20 8.5 4 20 4z",
    eyes: [15, 25, 19],
  },
  {
    name: "School",
    when: "Weekdays, 07:00",
    d: "M17.6 4.6a4.8 4.8 0 014.8 0l10.4 6a4.8 4.8 0 012.4 4.2v10.4a4.8 4.8 0 01-2.4 4.2l-10.4 6a4.8 4.8 0 01-4.8 0l-10.4-6a4.8 4.8 0 01-2.4-4.2V14.8a4.8 4.8 0 012.4-4.2z",
    eyes: [15.2, 24.8, 19.5],
  },
  {
    name: "Timesheet",
    when: "Sundays, 13:00",
    d: "M15 3.5h10a7 7 0 017 7v19a7 7 0 01-7 7H15a7 7 0 01-7-7v-19a7 7 0 017-7z",
    eyes: [15.6, 24.4, 16.5],
  },
] as const;

function GrokBotNode() {
  return (
    <div className={`${box} border-dashed p-4 pt-5 lg:p-5 lg:pt-6`}>
      <span className="absolute -top-2.5 left-4 bg-bg px-1.5">
        <Caption>In Grok Bot</Caption>
      </span>
      <div className="flex items-center gap-3">
        <KiwiBlob size={38} title="Kiwi" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Kiwi</p>
          <p className="text-[13px] text-ink-2">Talks to you and hands jobs to the other bots.</p>
        </div>
      </div>
      <ul className="ml-[18px] mt-1.5">
        {SUB_BOTS.map((b, i) => (
          <li key={b.name} className="relative flex items-center gap-2.5 py-1.5 pl-6">
            {/* tree branch: a trunk from Kiwi down to the last sub-bot, a twig to each */}
            <span
              aria-hidden
              className={`absolute left-0 w-[1.5px] bg-ink ${i === 0 ? "-top-1.5" : "top-0"} ${i === SUB_BOTS.length - 1 ? "bottom-1/2" : "bottom-0"}`}
            />
            <span aria-hidden className="absolute left-0 top-1/2 h-[1.5px] w-4 bg-ink" />
            <svg width="24" height="24" viewBox="0 0 40 40" className="shrink-0" aria-hidden>
              <path d={b.d} fill="#fff" stroke="currentColor" strokeWidth="2.6" />
              <ellipse cx={b.eyes[0]} cy={b.eyes[2]} rx="2.2" ry="3" fill="currentColor" />
              <ellipse cx={b.eyes[1]} cy={b.eyes[2]} rx="2.2" ry="3" fill="currentColor" />
            </svg>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-medium">{b.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-3">
                <IconClock size={11} />
                {b.when}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TOOLS = ["Tasks", "Reminders", "Habits", "Projects", "Calendar", "Widgets"];

function McpNode() {
  return (
    <div className={`${box} p-4 lg:p-5`}>
      <Caption>Hyperpolymath MCP</Caption>
      <p className="mt-2 text-[15px] font-semibold">One database for every bot</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {TOOLS.map((t) => (
          <li key={t} className="rounded-full border border-ink/15 px-2.5 py-1 text-[12px] text-ink-2">
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[11px] text-ink-3">every write is logged and revertible</p>
    </div>
  );
}

function DashboardNode() {
  return (
    <div className={`${box} p-4 lg:p-5`}>
      <Caption>Live dashboard</Caption>
      <div className="mt-3 grid grid-cols-2 gap-1.5" aria-hidden>
        <div className="col-span-2 rounded-[8px] border border-ink/15 p-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-accent text-white">
              <IconCheck size={8} strokeWidth={3} />
            </span>
            <span className="h-1.5 w-14 rounded-full bg-gray-300" />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-ink/40" />
            <span className="h-1.5 w-10 rounded-full bg-gray-200" />
          </div>
        </div>
        <div className="h-14 space-y-1 rounded-[8px] border border-ink/15 p-2">
          <span className="block h-3.5 w-full rounded-[4px] border-l-2 border-ink bg-gray-100" />
          <span className="block h-2.5 w-2/3 rounded-[4px] border-l-2 border-ink/40 bg-gray-100" />
        </div>
        <div className="h-14 space-y-1 rounded-[8px] border border-ink/15 p-2">
          <span className="block h-1.5 w-full rounded-full bg-gray-200" />
          <span className="block h-1.5 w-3/4 rounded-full bg-gray-200" />
          <span className="block h-1.5 w-1/2 rounded-full bg-gray-200" />
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-snug text-ink-2">Shows a bot&apos;s change within a second.</p>
    </div>
  );
}

/** A two-way link: arrowheads at both ends, a label, and a travelling dot. */
function Connector({ label, index }: { label: string; index: number }) {
  const delay: CSSProperties = { animationDelay: `${index * 0.9}s` };
  return (
    <div className="relative flex h-16 items-center justify-center lg:h-auto lg:self-stretch" aria-hidden>
      <div className="relative h-full w-[1.5px] bg-ink lg:h-[1.5px] lg:w-full">
        <Arrowhead className="-top-px left-1/2 -translate-x-1/2 -rotate-90 lg:left-0 lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0 lg:rotate-180" />
        <Arrowhead className="-bottom-px left-1/2 -translate-x-1/2 rotate-90 lg:bottom-auto lg:left-auto lg:right-0 lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0 lg:rotate-0" />
        <span
          className="landing-flow absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_3px_rgb(16_132_254/0.15)] lg:left-0 lg:top-1/2"
          style={delay}
        />
      </div>
      <span className="absolute left-1/2 top-1/2 ml-4 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium text-ink-3 lg:left-1/2 lg:top-auto lg:bottom-1/2 lg:mb-2.5 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0 lg:whitespace-normal lg:text-center lg:leading-tight">
        {label}
      </span>
    </div>
  );
}

function Arrowhead({ className }: { className: string }) {
  return (
    <svg width="8" height="10" viewBox="0 0 8 10" className={`absolute ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 1.5 6.5 5l-5 3.5" />
    </svg>
  );
}
