import type { ReactNode } from "react";
import { IconArrowRight, IconCheck } from "@/components/ui/icons";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { revealDelay } from "./reveal";

// "How it's organized": life areas hold projects (classes are projects too),
// projects hold tasks and captures, and habits hang off areas. Drawn as the
// real thing in miniature, with generic examples.

type Task = { title: string; due?: string; done?: boolean };
type Project = { name: string; tag?: string; tasks: Task[]; capture: string };

const SCHOOL: Project[] = [
  {
    name: "Machine Elements",
    tag: "Class",
    tasks: [
      { title: "Problem set 4", due: "Thu" },
      { title: "Gear train sketch", done: true },
    ],
    capture: "Bearing life formula, check the table",
  },
  {
    name: "Fluid Mechanics",
    tag: "Class",
    tasks: [
      { title: "Review fluids", due: "Tomorrow" },
      { title: "Lab write-up", due: "Fri" },
    ],
    capture: "Ask about the Bernoulli demo",
  },
];

const HABITS = [
  { name: "Morning run", progress: 1, streak: "12-day streak" },
  { name: "Stretch", progress: 0.66, streak: "4-day streak" },
];

export function Organized() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-[1080px]">
        <header data-reveal className="mx-auto max-w-[640px] text-center">
          <p className="text-[13px] font-medium text-accent">How it&apos;s organized</p>
          <h2 className="mt-3 text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">
            Everything lives under a life area
          </h2>
        </header>

        <Legend />

        <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
          <Area emoji="🎓" name="School">
            <div className="grid gap-3 sm:grid-cols-2">
              {SCHOOL.map((p) => (
                <ProjectCard key={p.name} project={p} />
              ))}
            </div>
          </Area>
          <Area emoji="💪" name="Health" delay={140}>
            <p className="mb-2 text-[12px] font-medium text-ink-3">Habits</p>
            <ul className="space-y-2">
              {HABITS.map((h) => (
                <li key={h.name} className="flex items-center gap-3 rounded-[14px] bg-surface p-3 shadow-ring">
                  <Ring progress={h.progress} />
                  <div className="leading-tight">
                    <p className="text-[13px] font-medium">{h.name}</p>
                    <p className="mt-0.5 text-[12px] text-ink-3">{h.streak}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <ProjectCard project={{ name: "Half marathon", tasks: [{ title: "Long run, 14 km", due: "Sat" }], capture: "" }} />
            </div>
          </Area>
        </div>

        <div data-reveal className="mx-auto mt-14 flex max-w-[600px] flex-col items-center text-center sm:mt-16">
          <p className="text-pretty text-[15px] leading-[1.7] text-ink-2">
            Kiwi only files something under a project when it obviously belongs there. Otherwise it goes to the inbox.
            Either way, it tells you where it went:
          </p>
          <p className="mt-4 flex items-end gap-2">
            <KiwiBlob size={26} title="Kiwi" />
            <span className="rounded-[18px] rounded-bl-[6px] bg-gray-200 px-3.5 py-1.5 text-[14px] leading-snug text-ink">
              Added to Fluid Mechanics.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

function Legend() {
  const steps = ["Life area", "Project", "Tasks and captures"];
  return (
    <div data-reveal style={revealDelay(80)} className="mt-8 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-3 text-[12px] text-ink-2 sm:gap-x-2 sm:text-[13px]">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          {i > 0 ? <IconArrowRight size={13} className="text-ink-3" /> : null}
          <span className="rounded-full px-2.5 py-1 shadow-ring sm:px-3">{s}</span>
        </span>
      ))}
      <span className="basis-full text-center text-ink-3 sm:ml-2 sm:basis-auto">Classes count as projects. Habits attach to an area.</span>
    </div>
  );
}

function Area({ emoji, name, delay = 0, children }: { emoji: string; name: string; delay?: number; children: ReactNode }) {
  return (
    <div data-reveal style={revealDelay(delay)} className="rounded-[22px] bg-subtle p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span aria-hidden className="text-[18px] leading-none">
          {emoji}
        </span>
        <p className="text-[15px] font-semibold">{name}</p>
        <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Area</span>
      </div>
      {children}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="rounded-[16px] bg-surface p-3.5 shadow-ring">
      <div className="flex items-center gap-2">
        <p className="min-w-0 truncate text-[14px] font-semibold">{project.name}</p>
        {project.tag ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-ink-2">{project.tag}</span> : null}
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {project.tasks.map((t) => (
          <li key={t.title} className="flex items-center gap-2 text-[13px]">
            {t.done ? (
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                <IconCheck size={9} strokeWidth={3} />
              </span>
            ) : (
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-ink/35" />
            )}
            <span className={`min-w-0 flex-1 truncate ${t.done ? "text-ink-3 line-through" : ""}`}>{t.title}</span>
            {t.due ? <span className="text-[12px] text-ink-3">{t.due}</span> : null}
          </li>
        ))}
      </ul>
      {project.capture ? (
        <p className="mt-2.5 flex items-start gap-2 rounded-[10px] bg-subtle px-2.5 py-1.5 text-[12px] leading-snug text-ink-2">
          <span aria-hidden className="mt-px font-serif text-[14px] leading-none text-ink-3">&ldquo;</span>
          <span className="min-w-0">
            <span className="sr-only">Capture: </span>
            {project.capture}
          </span>
        </p>
      ) : null}
    </div>
  );
}

function Ring({ progress }: { progress: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex shrink-0 items-center justify-center" aria-hidden>
      <svg width="30" height="30" viewBox="0 0 30 30" className="-rotate-90">
        <circle cx="15" cy="15" r={r} fill="none" stroke="var(--gray-200)" strokeWidth="3.5" />
        <circle cx="15" cy="15" r={r} fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${c * progress} ${c}`} />
      </svg>
      {progress >= 1 ? <IconCheck size={12} strokeWidth={2.75} className="absolute" /> : null}
    </span>
  );
}
