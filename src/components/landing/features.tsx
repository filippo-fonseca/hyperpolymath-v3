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

// Two verticals: the fixed core that is always on the dashboard, and the
// custom widgets your bots build and publish when you ask. The dashed border
// on the custom side echoes the "In Grok Bot" box in the diagram.

const ART = 64;

type Fixed = { title: string; body: string; art: ReactNode; chips?: { icon: ReactNode; label: string }[] };

const FIXED: Fixed[] = [
  {
    title: "Tasks",
    body: "Priorities, due dates and tasks that repeat.",
    art: <KiwiSleeping size={ART} animated />,
    chips: [
      { icon: <IconList size={12} />, label: "List" },
      { icon: <IconBoard size={12} />, label: "Board" },
      { icon: <IconTable size={12} />, label: "Table" },
    ],
  },
  {
    title: "Calendar",
    body: "Your Google calendars, with bot changes logged too.",
    art: <KiwiStargazing size={ART} />,
    chips: [
      { icon: <IconCalendar size={12} />, label: "Week" },
      { icon: <IconCalendar size={12} />, label: "Month" },
    ],
  },
  {
    title: "Habits",
    body: "Rings for today and streaks that only count the days you planned.",
    art: <KiwiWatering size={ART} />,
  },
  {
    title: "Quick capture",
    body: "Park a thought in a second. It resurfaces when you asked.",
    art: <KiwiReading size={ART} />,
  },
  {
    title: "Projects and areas",
    body: "Life areas hold projects and classes, and everything files under them.",
    art: <KiwiBuilding size={ART} />,
  },
  {
    title: "Activity and Teammates",
    body: "Every change logged with one-tap Revert. See every bot and pause any routine.",
    art: <KiwiTeam size={ART} />,
  },
];

export function Features() {
  return (
    <section className="bg-subtle px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-[1080px]">
        <header className="mx-auto max-w-[680px] text-center">
          <p className="text-[13px] font-medium text-accent">On the dashboard</p>
          <h2 className="mt-3 text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">
            A fixed core. Room for whatever your bots build.
          </h2>
          <p className="mx-auto mt-5 max-w-[540px] text-pretty text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            One screen of widgets you can rearrange and resize. Tap any of them to open the full view.
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

function ColumnHeader({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-3">
      <h3 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h3>
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{note}</p>
    </div>
  );
}

function FixedColumn() {
  return (
    <div className="rounded-[26px] bg-surface p-5 shadow-ring sm:p-7">
      <ColumnHeader title="Fixed features" note="Built in" />
      <p className="-mt-2 mb-5 text-[14px] leading-relaxed text-ink-2">The core of the app. Always there, always yours to edit by hand.</p>
      <ul className="divide-y divide-ink/[0.06]">
        {FIXED.map((f) => (
          <li key={f.title} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
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
    Ask Kiwi: <span className="text-ink">&ldquo;check Slack every night and put it on the dashboard.&rdquo;</span>
  </>,
  <>The bot publishes to its own widget, with its own icon, only when something changed. Past runs are kept.</>,
  <>Pause its routine from Teammates any time. A widget that misses its window greys out.</>,
];

function CustomColumn() {
  return (
    <div className="rounded-[26px] border-[1.5px] border-dashed border-ink/30 p-5 sm:p-7">
      <ColumnHeader title="Custom widgets" note="Built by bots" />
      <p className="-mt-2 mb-5 text-[14px] leading-relaxed text-ink-2">
        Extensible by your bots: digests, lists, stats and tables. Data, never code.
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
              <span className="text-ink-2">A decision on the date is waiting</span>
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
          <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-ink-2">
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
