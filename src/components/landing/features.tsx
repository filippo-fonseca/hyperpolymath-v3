import type { ReactNode } from "react";
import {
  KiwiBuilding,
  KiwiReading,
  KiwiSleeping,
  KiwiStargazing,
  KiwiTeam,
  KiwiWatering,
} from "@/components/illustrations";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { IconBoard, IconCalendar, IconList, IconTable } from "@/components/ui/icons";
import { revealDelay } from "./reveal";

// Two verticals: the fixed core that is always on the dashboard, and the
// custom widgets your bots build and publish when you ask. The dashed border
// on the custom side echoes the "In Grok Bot" box in the diagram.

const ART = 64;

type Fixed = { title: string; body: string; art: ReactNode; chips?: { icon: ReactNode; label: string }[] };

const FIXED: Fixed[] = [
  {
    title: "Tasks",
    body: "Due dates and priorities. A repeating task rolls forward when you finish it.",
    art: <KiwiSleeping size={ART} animated />,
    chips: [
      { icon: <IconList size={12} />, label: "List" },
      { icon: <IconBoard size={12} />, label: "Board" },
      { icon: <IconTable size={12} />, label: "Table" },
    ],
  },
  {
    title: "Calendar",
    body: "Your Google calendars. When a bot moves an event, that gets logged like anything else.",
    art: <KiwiStargazing size={ART} />,
    chips: [
      { icon: <IconCalendar size={12} />, label: "Week" },
      { icon: <IconCalendar size={12} />, label: "Month" },
    ],
  },
  {
    title: "Habits",
    body: "A ring per habit for today. Streaks only count the days you planned, so a rest day won't break one.",
    art: <KiwiWatering size={ART} />,
  },
  {
    title: "Quick capture",
    body: "For thoughts that aren't tasks yet. Give one a date and it comes back then.",
    art: <KiwiReading size={ART} />,
  },
  {
    title: "Projects and areas",
    body: "Areas like School or Health, with projects and classes inside them.",
    art: <KiwiBuilding size={ART} />,
  },
  {
    title: "Activity log and Teammates",
    body: "Each change, yours or a bot's, has a Revert button. Teammates lists your bots and lets you pause their routines.",
    art: <KiwiTeam size={ART} />,
  },
];

export function Features() {
  return (
    <section className="bg-subtle px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-[1080px]">
        <header data-reveal className="mx-auto max-w-[680px] text-center">
          <h2 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">
            What&apos;s on the dashboard
          </h2>
          <p className="mx-auto mt-5 max-w-[540px] text-pretty text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            Everything sits on one screen as widgets you can drag around and resize. Tap a widget to open its full page.
          </p>
        </header>

        <div className="mt-14 grid gap-5 sm:mt-16 lg:grid-cols-2">
          <FixedColumn />
          <CustomColumn />
        </div>
      </div>
    </section>
  );
}

function ColumnHeader({ title, note, casual = false }: { title: string; note: string; casual?: boolean }) {
  return (
    <div className={`mb-5 flex justify-between gap-x-4 gap-y-1 ${casual ? "flex-col" : "items-baseline"}`}>
      <h3 className="shrink-0 text-[20px] font-semibold tracking-[-0.02em]">{title}</h3>
      <p
        className={
          casual
            ? "mt-1 text-pretty text-[14px] leading-relaxed text-ink"
            : "text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3"
        }
      >
        {note}
      </p>
    </div>
  );
}

function FixedColumn() {
  return (
    <div data-reveal className="rounded-[26px] bg-surface p-5 shadow-ring sm:p-7">
      <ColumnHeader title="Built in" note="Always there" />
      <p className="-mt-2 mb-5 text-[14px] leading-relaxed text-ink-2">These ship with the app. You can edit anything in them by hand, same as a bot can.</p>
      <ul className="divide-y divide-ink/[0.06]">
        {FIXED.map((f, i) => (
          <li key={f.title} data-reveal style={revealDelay(120 + i * 70)} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] bg-subtle">{f.art}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold tracking-[-0.01em]">{f.title}</p>
              <p className="mt-0.5 text-pretty text-[13px] leading-snug text-ink-2">{f.body}</p>
              {f.chips ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.chips.map((c) => (
                    <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-ink-2">
                      {c.icon}
                      {c.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const HOW_CUSTOM = [
  <>
    You ask Kiwi something like{" "}
    <span className="text-ink">&ldquo;check Slack every night and put it on the dashboard.&rdquo;</span>
  </>,
  <>Each night the bot updates its widget, but only if something changed. Open the widget to scroll back through old runs.</>,
  <>You can pause the routine from Teammates. If a run gets missed, the widget greys out so you know it&apos;s stale.</>,
];

function CustomColumn() {
  return (
    <div data-reveal style={revealDelay(140)} className="rounded-[26px] border-[1.5px] border-dashed border-ink/30 p-5 sm:p-7">
      <ColumnHeader title="Made by your bots" note="You just have to ask your coordinator to make a new widget! It will spawn a bot for it and make a UI widget right in your dashboard. Toggle it on or off anytime." casual />
      <p className="-mt-2 mb-5 text-[14px] leading-relaxed text-ink-2">
        A bot can publish a digest, list, stat or table to a widget of its own. It only ever sends data, so it can&apos;t
        break the page.
      </p>

      <div className="space-y-3" aria-hidden>
        <WidgetMock icon="💬" title="Slack roundup" owner={{ name: "Slack Roundup", avatar_shape: "squircle" }} meta="7h ago">
          <ul className="space-y-1.5 text-[13px]">
            <li className="flex gap-2">
              <span className="w-[64px] shrink-0 font-medium">#design</span>
              <span className="text-ink-2">2 threads mention you</span>
            </li>
            <li className="flex gap-2">
              <span className="w-[64px] shrink-0 font-medium">#launch</span>
              <span className="text-ink-2">Someone is waiting on you</span>
            </li>
          </ul>
        </WidgetMock>
        <div className="grid grid-cols-2 gap-3">
          <WidgetMock icon="🛒" title="Groceries" owner={{ name: "Kiwi" }}>
            <ul className="space-y-1 text-[13px] text-ink-2">
              <li>Oat milk</li>
              <li>Eggs</li>
              <li>Basil</li>
            </ul>
          </WidgetMock>
          <WidgetMock icon="⏱️" title="Hours" owner={{ name: "Timesheet", avatar_shape: "tablet" }}>
            <p className="text-[22px] font-semibold leading-none tracking-[-0.02em]">32.5 h</p>
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="mt-2 h-6 w-full" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 18 18 15l16 4 16-9 16 3 16-8 16-1" vectorEffect="non-scaling-stroke" />
            </svg>
          </WidgetMock>
        </div>
      </div>

      <ol className="mt-6 space-y-3">
        {HOW_CUSTOM.map((step, i) => (
          <li key={i} data-reveal style={revealDelay(i * 110)} className="flex gap-3 text-[13px] leading-relaxed text-ink-2">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-[11px] font-semibold tabular-nums text-ink">
              {i + 1}
            </span>
            <span className="text-pretty">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function WidgetMock({
  icon,
  title,
  owner,
  meta,
  children,
}: {
  icon: string;
  title: string;
  owner: { name: string; avatar_shape?: string };
  meta?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[18px] bg-surface p-3.5 shadow-widget">
      <div className="flex items-center gap-1.5">
        <span className="text-[14px] leading-none">{icon}</span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</p>
        {meta ? <span className="text-[11px] text-ink-3">{meta}</span> : null}
      </div>
      <div className="mt-3">{children}</div>
      <span className="mt-3 inline-flex h-[22px] max-w-full items-center gap-1.5 rounded-full bg-gray-100 pl-0.5 pr-2 text-[11.5px] font-medium text-gray-600">
        <BotAvatar bot={{ name: owner.name, avatar_shape: owner.avatar_shape, avatar_color: "blue" }} size={18} />
        <span className="truncate">{owner.name}</span>
      </span>
    </div>
  );
}
