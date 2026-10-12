import type { ReactNode } from "react";
import {
  KiwiBuilding,
  KiwiReading,
  KiwiSleeping,
  KiwiStargazing,
  KiwiTeam,
  KiwiWaiting,
  KiwiWatering,
} from "@/components/illustrations";
import { IconBoard, IconCalendar, IconList, IconTable, IconUndo } from "@/components/ui/icons";

const ART = 120;

const FEATURES: { title: string; body: string; art: ReactNode; chips?: { icon?: ReactNode; label: string }[] }[] = [
  {
    title: "Tasks",
    body: "Priorities, due dates and tasks that repeat. When nothing is due, Kiwi naps.",
    art: <KiwiSleeping size={ART} animated />,
    chips: [
      { icon: <IconList size={13} />, label: "List" },
      { icon: <IconBoard size={13} />, label: "Board" },
      { icon: <IconTable size={13} />, label: "Table" },
    ],
  },
  {
    title: "Calendar",
    body: "Your Google calendars side by side. Changes from bots are logged like everything else.",
    art: <KiwiStargazing size={ART} />,
    chips: [
      { icon: <IconCalendar size={13} />, label: "Week" },
      { icon: <IconCalendar size={13} />, label: "Month" },
    ],
  },
  {
    title: "Habits",
    body: "Rings for today and streaks that only count the days you planned. Today never breaks one.",
    art: <KiwiWatering size={ART} />,
  },
  {
    title: "Quick capture",
    body: "Park a thought in a second, from the app, a bot or a phone shortcut. It resurfaces when you asked.",
    art: <KiwiReading size={ART} />,
  },
  {
    title: "Projects and life areas",
    body: "Areas hold projects and classes. Tasks and captures are filed where they clearly belong.",
    art: <KiwiBuilding size={ART} />,
  },
  {
    title: "Custom widgets",
    body: "Routines publish digests, lists, stats and tables. Data, never code, with every past run kept.",
    art: <KiwiWaiting size={ART} />,
  },
];

export function Features() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-[1080px]">
        <header className="mx-auto max-w-[640px] text-center">
          <p className="text-[13px] font-medium text-accent">On the dashboard</p>
          <h2 className="mt-3 text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">
            Everything at a glance. Nothing extra.
          </h2>
          <p className="mx-auto mt-5 max-w-[540px] text-pretty text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            One screen of widgets you can rearrange and resize. Tap any of them to open the full view.
          </p>
        </header>

        <ul className="mt-14 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex flex-col overflow-hidden rounded-[22px] bg-surface shadow-ring">
              <div className="flex h-[128px] items-end justify-center bg-subtle sm:h-[148px]">{f.art}</div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                <p className="mt-1.5 text-pretty text-[14px] leading-relaxed text-ink-2">{f.body}</p>
                {f.chips ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {f.chips.map((c) => (
                      <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[12px] text-ink-2">
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

        <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">
          <ActivityCard />
          <TeammatesCard />
        </div>
      </div>
    </section>
  );
}

const LOG = [
  { who: "Kiwi", what: "completed Laundry", when: "2m" },
  { who: "School", what: "added Problem set 4", when: "1h" },
];

function ActivityCard() {
  return (
    <div className="flex flex-col gap-5 rounded-[22px] bg-surface p-5 shadow-ring sm:flex-row sm:items-center sm:p-6">
      <div className="flex-1">
        <h3 className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]">
          <IconUndo size={16} />
          Activity and Revert
        </h3>
        <p className="mt-1.5 text-pretty text-[14px] leading-relaxed text-ink-2">
          Every change by you or any bot is logged with a before and after. One tap puts it back.
        </p>
      </div>
      <ul className="w-full shrink-0 space-y-1.5 sm:w-[264px]" aria-hidden>
        {LOG.map((l) => (
          <li key={l.what} className="flex items-center gap-2 rounded-[12px] bg-subtle px-3 py-2 text-[12px]">
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{l.who}</span> <span className="text-ink-2">{l.what}</span>
            </span>
            <span className="text-ink-3">{l.when}</span>
            <span className="rounded-full bg-surface px-2 py-0.5 font-medium shadow-ring">Revert</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeammatesCard() {
  return (
    <div className="flex items-center gap-4 rounded-[22px] bg-surface p-5 shadow-ring sm:p-6">
      <div className="flex-1">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em]">Teammates</h3>
        <p className="mt-1.5 text-pretty text-[14px] leading-relaxed text-ink-2">
          See every bot under Kiwi, what each routine does and when it last ran. Pause any routine with one switch.
        </p>
      </div>
      <KiwiTeam size={96} className="shrink-0" />
    </div>
  );
}
