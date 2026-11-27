"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  headline,
  hourLabel,
  hoursOf,
  weekdaysOf,
  type BotSeries,
  type InsightRange,
  type Insights,
  type InsightsData,
  type Kpi,
  type Slice,
} from "@/lib/insights";
import type { LocalDate } from "@/lib/time";
import { ACCENT_HEX, ChartEnv, CountUp, EASE, Legend, SERIES_ORDER, fmtNum, shortDay } from "@/components/charts/core";
import { LineChart } from "@/components/charts/line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Donut } from "@/components/charts/radial";
import { Heatmap, HeatmapKey } from "@/components/charts/heatmap";
import { Punchcard } from "@/components/charts/punchcard";
import { Sparkline } from "@/components/widgets/custom/renderers";
import { AVATAR_COLORS } from "@/components/ui/bot-avatar";
import { IconArrowDown, IconArrowUp, IconChart } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/primitives";

// The Insights page: how the last week, month or quarter went, drawn from the
// same rows the dashboard reads. Every range is computed up front, so the
// switch is instant and the charts redraw with their own animations.

const BLUE = ACCENT_HEX.blue;
const GREEN = ACCENT_HEX.green;
const PURPLE = ACCENT_HEX.purple;
const ORANGE = ACCENT_HEX.orange;
const RANGE_LABEL: Record<InsightRange, string> = {
  7: "Last 7 days",
  30: "Last 30 days",
  90: "Last 90 days",
};

/** Sum values into weeks (newest week ends today) once a range is long enough to be noisy. */
function bucket(values: number[], days: LocalDate[], size: number) {
  if (size <= 1) return { values, labels: days.map(shortDay) };
  const out: number[] = [];
  const labels: string[] = [];
  for (let end = values.length; end > 0; end -= size) {
    const start = Math.max(0, end - size);
    out.unshift(values.slice(start, end).reduce((a, b) => a + b, 0));
    labels.unshift(shortDay(days[start]));
  }
  return { values: out, labels };
}

/** Bot colors follow the bot's avatar; a clash falls through to the next free series hue. */
function actorColors(actors: BotSeries[]) {
  const used = new Set<string>();
  const free = SERIES_ORDER.map((a) => ACCENT_HEX[a]);
  return actors.map((a) => {
    if (a.id === null) return "var(--gray-800)";
    if (a.id === "other") return "var(--gray-400)";
    let c = AVATAR_COLORS[a.color] ?? (a.color.startsWith("#") ? a.color : undefined);
    if (!c || used.has(c)) c = free.find((f) => !used.has(f)) ?? "var(--gray-500)";
    used.add(c);
    return c;
  });
}

/** Slice colors keyed by name from the half-year ranking, so a project keeps its color across ranges. */
function sliceColors(year: Slice[]) {
  const map = new Map<string, string>();
  year.filter((s) => s.label !== "Other").forEach((s, i) => i < SERIES_ORDER.length && map.set(s.label, ACCENT_HEX[SERIES_ORDER[i]]));
  return (s: Slice, i: number) => (s.label === "Other" ? "var(--gray-400)" : (map.get(s.label) ?? ACCENT_HEX[SERIES_ORDER[i % SERIES_ORDER.length]]));
}

function isEmpty(d: InsightsData) {
  const y = d.year;
  return !y.done.some(Boolean) && !y.habitRate.some((v) => v !== null && v > 0) && !y.actors.length && !y.captures.some(Boolean);
}

export function InsightsView({ data, nowMs, range, onRange }: { data: InsightsData; nowMs: number; range: InsightRange; onRange: (r: InsightRange) => void }) {
  const i = data.ranges[range];
  const empty = isEmpty(data);

  return (
    <ChartEnv tz={data.tz} nowMs={nowMs}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 text-[13px] font-semibold text-gray-500">
            {shortDay(i.days[0])} to {shortDay(data.today)}
          </div>
          <h1 className="truncate text-[30px] font-bold leading-tight tracking-[-0.025em]">Insights</h1>
        </div>
        <Segmented
          value={String(range) as `${InsightRange}`}
          onChange={(v) => onRange(Number(v) as InsightRange)}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
      </div>

      {empty ? (
        <EmptyInsights />
      ) : (
        <div className="flex flex-col gap-4 sm:gap-5">
          <Hero i={i} range={range} />
          <KpiRow i={i} range={range} />
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
            <TasksCard i={i} range={range} className="lg:col-span-3" />
            <FocusCard i={i} year={data.year} range={range} className="lg:col-span-2" />
          </div>
          <HabitsCard i={i} year={data.year} range={range} />
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
            <RhythmCard i={i} range={range} className="lg:col-span-3" />
            <RoutinesCard i={i} range={range} className="lg:col-span-2" />
          </div>
          <TeamCard i={i} range={range} />
        </div>
      )}
    </ChartEnv>
  );
}

// Layout pieces ---------------------------------------------------------------

function Card({
  title,
  sub,
  aside,
  children,
  className = "",
  delay = 0,
}: {
  title: string;
  sub?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className={`min-w-0 rounded-widget bg-surface p-5 shadow-widget sm:p-6 ${className}`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
          {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
        </div>
        {aside}
      </header>
      {children}
    </motion.section>
  );
}

/** Redraws its chart when the range changes, with a quick crossfade. */
function Swap({ k, children, className = "" }: { k: string | number; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={k} className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Hero ------------------------------------------------------------------------

function Hero({ i, range }: { i: Insights; range: InsightRange }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="relative overflow-hidden rounded-widget bg-surface px-5 py-6 shadow-widget sm:px-7 sm:py-7"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -right-16 -top-24 h-64 w-64 rounded-full blur-3xl"
          style={{ background: `color-mix(in srgb, ${BLUE} 16%, transparent)` }}
          animate={reduce ? undefined : { x: [0, -24, 0], y: [0, 16, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-28 right-40 h-56 w-56 rounded-full blur-3xl"
          style={{
            background: `color-mix(in srgb, ${GREEN} 13%, transparent)`,
          }}
          animate={reduce ? undefined : { x: [0, 30, 0], y: [0, -12, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="relative">
        <div className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
          <IconChart size={14} />
          {RANGE_LABEL[range]}
        </div>
        <Swap k={range}>
          <p className="max-w-[720px] text-balance text-[21px] font-semibold leading-snug tracking-[-0.015em] sm:text-[24px]">{headline(i)}</p>
        </Swap>
        <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
          <Chip label="Open tasks" value={i.kpis.open} />
          <Chip label="Overdue" value={i.kpis.overdue} warn={i.kpis.overdue > 0} />
          <Chip label="Best streak" value={i.kpis.bestStreak} unit={i.kpis.bestStreak === 1 ? "day" : "days"} />
          <Chip label="Captures" value={i.kpis.captures.value ?? 0} />
        </div>
      </div>
    </motion.section>
  );
}

function Chip({ label, value, unit, warn }: { label: string; value: number; unit?: string; warn?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 shadow-[inset_0_0_0_1px_rgb(20_20_20/0.05)]">
      {warn && <span className="h-1.5 w-1.5 rounded-full bg-[#f08a24]" aria-hidden />}
      <span className="text-ink-2">{label}</span>
      <span className="font-semibold tabular-nums text-ink">
        <CountUp value={value} />
        {unit && <span className="font-normal text-ink-3"> {unit}</span>}
      </span>
    </span>
  );
}

// KPIs ------------------------------------------------------------------------

function KpiRow({ i, range }: { i: Insights; range: InsightRange }) {
  const doneWeekly = bucket(i.done, i.days, range >= 60 ? 7 : 1).values;
  const habitLine = i.habitRate.map((v) => v ?? 0);
  const k = i.kpis;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiTile label="Tasks done" kpi={k.done} spark={doneWeekly} color={BLUE} delay={0.04} />
      <KpiTile
        label="Habits kept"
        kpi={k.habitRate}
        unit="%"
        points
        spark={range >= 60 ? bucket(habitLine, i.days, 7).values : habitLine}
        color={GREEN}
        delay={0.08}
      />
      <KpiTile label="Done on time" kpi={k.onTime} unit="%" points color={PURPLE} delay={0.12} ring />
      <KpiTile
        label="Teammate actions"
        kpi={k.botActions}
        spark={bucket(sumSeries(i.actors.filter((a) => a.id !== null)), i.days, range >= 60 ? 7 : 1).values}
        color={ORANGE}
        delay={0.16}
      />
    </div>
  );
}

function sumSeries(s: BotSeries[]) {
  const n = s[0]?.values.length ?? 0;
  return Array.from({ length: n }, (_, d) => s.reduce((a, x) => a + x.values[d], 0));
}

function Delta({ kpi, points }: { kpi: Kpi; points?: boolean }) {
  if (kpi.value === null || kpi.previous === null) return <span className="text-[12px] text-ink-3">no earlier data</span>;
  const diff = points ? kpi.value - kpi.previous : kpi.previous === 0 ? null : Math.round(((kpi.value - kpi.previous) / kpi.previous) * 100);
  if (diff === null) return <span className="text-[12px] text-ink-3">new this period</span>;
  if (diff === 0) return <span className="text-[12px] text-ink-3">same as before</span>;
  const up = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[12px] font-semibold tabular-nums ${up ? "bg-[#2fb26b]/10 text-[#1f8a51]" : "bg-[#f2484b]/10 text-[#c8322f]"}`}
    >
      {up ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}
      {Math.abs(diff)}
      {points ? " pts" : "%"}
    </span>
  );
}

function KpiTile({
  label,
  kpi,
  unit = "",
  points,
  spark,
  color,
  delay,
  ring,
}: {
  label: string;
  kpi: Kpi;
  unit?: string;
  points?: boolean;
  spark?: number[];
  color: string;
  delay: number;
  ring?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className="flex min-w-0 flex-col rounded-widget bg-surface p-4 shadow-widget sm:p-5"
    >
      <div className="flex items-center gap-2 text-[13px] text-ink-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums sm:text-[34px]">
          {kpi.value === null ? <span className="text-ink-3">–</span> : <CountUp value={kpi.value} format={(v) => fmtNum(v) + unit} />}
        </div>
        {ring && kpi.value !== null && <MiniRing pct={kpi.value} color={color} />}
      </div>
      <div className="mt-2">
        <Delta kpi={kpi} points={points} />
      </div>
      {spark && spark.length > 1 && <Sparkline values={spark} color={color} height={30} className="mt-3" />}
      {ring && <p className="mt-auto pt-3 text-[11.5px] leading-snug text-ink-3">Of tasks with a due date</p>}
    </motion.div>
  );
}

function MiniRing({ pct, color }: { pct: number; color: string }) {
  const reduce = useReducedMotion();
  const r = 15;
  return (
    <svg width={38} height={38} viewBox="0 0 38 38" className="-rotate-90 shrink-0" aria-hidden>
      <circle cx={19} cy={19} r={r} fill="none" stroke="var(--gray-150)" strokeWidth={5} />
      <motion.circle
        cx={19}
        cy={19}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: Math.max(0.001, pct / 100) }}
        transition={{ duration: 1, ease: EASE, delay: 0.2 }}
      />
    </svg>
  );
}

// Tasks -----------------------------------------------------------------------

function TasksCard({ i, range, className }: { i: Insights; range: InsightRange; className?: string }) {
  const [view, setView] = useState<"flow" | "done">("flow");
  const size = range >= 60 ? 7 : 1;
  const done = bucket(i.done, i.days, size);
  const created = bucket(i.created, i.days, size);
  const net = i.done.reduce((a, b) => a + b, 0) - i.created.reduce((a, b) => a + b, 0);
  return (
    <Card
      title="Tasks"
      sub={`${net === 0 ? "Finishing as fast as you add" : net > 0 ? `Backlog shrank by ${net}` : `Backlog grew by ${-net}`}${size > 1 ? ", by week" : ""}`}
      aside={
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "flow", label: "Done vs added" },
            { value: "done", label: "Done" },
          ]}
        />
      }
      className={className}
      delay={0.1}
    >
      <Swap k={`${range}-${view}`}>
        {view === "flow" ? (
          <>
            <LineChart
              height={262}
              labels={done.labels}
              area={false}
              series={[
                { name: "Done", values: done.values, color: BLUE },
                {
                  name: "Added",
                  values: created.values,
                  color: "var(--gray-400)",
                },
              ]}
            />
            <Legend
              className="mt-3"
              items={[
                {
                  label: "Done",
                  color: BLUE,
                  value: fmtNum(i.kpis.done.value ?? 0),
                },
                {
                  label: "Added",
                  color: "var(--gray-400)",
                  value: fmtNum(i.created.reduce((a, b) => a + b, 0)),
                },
              ]}
            />
          </>
        ) : (
          <BarChart height={286} labels={done.labels} highlightLast series={[{ name: "Done", values: done.values, color: BLUE }]} />
        )}
      </Swap>
    </Card>
  );
}

// Focus -----------------------------------------------------------------------

function FocusCard({ i, year, range, className }: { i: Insights; year: Insights; range: InsightRange; className?: string }) {
  const [by, setBy] = useState<"projects" | "areas">("projects");
  const slices = i[by];
  const color = useMemo(() => sliceColors(year[by]), [year, by]);
  const total = slices.reduce((a, s) => a + s.value, 0);
  return (
    <Card
      title="Where your focus went"
      sub="Tasks finished, by where they live"
      aside={
        <Segmented
          size="sm"
          value={by}
          onChange={setBy}
          options={[
            { value: "projects", label: "Projects" },
            { value: "areas", label: "Areas" },
          ]}
        />
      }
      className={className}
      delay={0.14}
    >
      <Swap k={`${range}-${by}`}>
        {total === 0 ? (
          <p className="py-10 text-center text-[14px] text-ink-3">Nothing finished in this window yet.</p>
        ) : (
          <Donut
            size={168}
            legend="below"
            center={{ value: total, label: "tasks" }}
            segments={slices.map((s, idx) => ({
              label: `${s.emoji ? `${s.emoji} ` : ""}${s.label}`,
              value: s.value,
              color: color(s, idx),
            }))}
          />
        )}
      </Swap>
    </Card>
  );
}

// Habits ----------------------------------------------------------------------

function HabitsCard({ i, year, range }: { i: Insights; year: Insights; range: InsightRange }) {
  const reduce = useReducedMotion();
  const habits = [...i.habits].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  return (
    <Card title="Habits" sub="Daily consistency over half a year, with partial credit for partial progress" aside={<HeatmapKey color={GREEN} />} delay={0.18}>
      <div className="grid items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <Heatmap start={year.days[0]} values={year.habitRate} max={100} color={GREEN} label="Habits kept" unit="%" maxCell={17} />
        {habits.length > 0 && (
          <ul className="grid gap-y-3.5 lg:pt-4">
            {habits.map((h, idx) => (
              <li key={h.id} className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2 text-[13.5px]">
                  <span className="shrink-0 text-[15px]" aria-hidden>
                    {h.icon ?? "•"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{h.name}</span>
                  {h.streak > 0 && (
                    <span
                      className="shrink-0 rounded-full bg-[#f08a24]/10 px-2 py-px text-[11.5px] font-semibold tabular-nums text-[#b5600f]"
                      title={`Best streak: ${h.best}`}
                    >
                      🔥 {h.streak}
                    </span>
                  )}
                  <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{h.rate === null ? "–" : `${h.rate}%`}</span>
                </div>
                <div className="relative h-[7px] overflow-hidden rounded-full bg-gray-150">
                  <motion.div
                    key={range}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: GREEN }}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${h.rate ?? 0}%` }}
                    transition={{
                      duration: 0.8,
                      ease: EASE,
                      delay: 0.1 + idx * 0.05,
                    }}
                  />
                  {h.best > 0 && h.rate !== null && <span className="sr-only">Best streak {h.best} days</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// Rhythm ----------------------------------------------------------------------

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function RhythmCard({ i, range, className }: { i: Insights; range: InsightRange; className?: string }) {
  const hours = hoursOf(i.rhythm);
  const days = weekdaysOf(i.rhythm);
  const total = hours.reduce((a, b) => a + b, 0);
  const peakH = hours.indexOf(Math.max(...hours));
  const peakD = days.indexOf(Math.max(...days));
  return (
    <Card
      title="When you get things done"
      sub={total ? `Busiest around ${hourLabel(peakH)}, and on ${WEEKDAYS[peakD]}s` : "Finish a few tasks to see your rhythm"}
      className={className}
      delay={0.22}
    >
      <Swap k={range}>
        <Punchcard grid={i.rhythm} color={BLUE} unit="tasks done" />
      </Swap>
    </Card>
  );
}

// Routines --------------------------------------------------------------------

function RoutinesCard({ i, range, className }: { i: Insights; range: InsightRange; className?: string }) {
  const { ok, error, skipped } = i.routines;
  const total = ok + error + skipped;
  const rate = total ? Math.round((ok / total) * 100) : null;
  return (
    <Card title="Routine runs" sub={total ? `${fmtNum(total)} runs by your teammates` : "No routine runs in this window"} className={className} delay={0.26}>
      <Swap k={range}>
        {total === 0 ? (
          <p className="py-10 text-center text-[14px] text-ink-3">When a teammate runs a routine, its health shows up here.</p>
        ) : (
          <Donut
            size={150}
            legend="below"
            center={{ value: `${rate}%`, label: "succeeded" }}
            segments={[
              { label: "✓ Succeeded", value: ok, color: GREEN },
              { label: "✕ Failed", value: error, color: "#f2484b" },
              { label: "– Skipped", value: skipped, color: "var(--gray-400)" },
            ]}
          />
        )}
      </Swap>
    </Card>
  );
}

// Teammates -------------------------------------------------------------------

function TeamCard({ i, range }: { i: Insights; range: InsightRange }) {
  const size = range >= 60 ? 7 : 1;
  const colors = actorColors(i.actors);
  const series = i.actors.map((a, idx) => ({
    ...a,
    color: colors[idx],
    b: bucket(a.values, i.days, size),
  }));
  const labels = series[0]?.b.labels ?? [];
  const botTotal = i.actors.filter((a) => a.id !== null).reduce((s, a) => s + a.total, 0);
  const all = i.actors.reduce((s, a) => s + a.total, 0);
  return (
    <Card
      title="Who did the work"
      sub={
        all
          ? `Teammates made ${Math.round((botTotal / all) * 100)}% of ${fmtNum(all)} changes${size > 1 ? ", by week" : ""}`
          : "No changes logged in this window"
      }
      delay={0.3}
    >
      {all > 0 && (
        <Swap k={range}>
          <BarChart
            height={220}
            stacked
            labels={labels}
            series={series.map((s) => ({
              name: s.name,
              values: s.b.values,
              color: s.color,
            }))}
          />
          <Legend
            className="mt-3"
            items={series.map((s) => ({
              label: s.name,
              color: s.color,
              value: fmtNum(s.total),
            }))}
          />
        </Swap>
      )}
    </Card>
  );
}

// Empty -----------------------------------------------------------------------

function EmptyInsights() {
  return (
    <div className="flex flex-col items-center rounded-widget bg-surface px-6 py-16 text-center shadow-widget">
      <motion.div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-accent-soft text-accent"
        initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.45, duration: 0.7 }}
      >
        <IconChart size={28} />
      </motion.div>
      <h2 className="text-[19px] font-semibold tracking-[-0.01em]">Your story starts here</h2>
      <p className="mt-2 max-w-[400px] text-[14px] leading-relaxed text-ink-2">
        Finish a few tasks, log some habits and let a teammate run a routine. This page turns all of it into trends, streaks and your daily rhythm.
      </p>
    </div>
  );
}

// Skeleton --------------------------------------------------------------------

export function InsightsSkeleton() {
  const block = "animate-pulse rounded-widget bg-gray-150";
  return (
    <div aria-busy="true" aria-label="Loading insights">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="mb-2 h-4 w-28 animate-pulse rounded bg-gray-150" />
          <div className="h-8 w-40 animate-pulse rounded-[10px] bg-gray-150" />
        </div>
        <div className="h-9 w-56 animate-pulse rounded-full bg-gray-150" />
      </div>
      <div className={`${block} h-[170px]`} />
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((k) => (
          <div key={k} className={`${block} h-[150px]`} />
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <div className={`${block} h-[330px] lg:col-span-3`} />
        <div className={`${block} h-[330px] lg:col-span-2`} />
      </div>
    </div>
  );
}

/** Loads the numbers once when opened, then hands them to the view. */
export function useInsights(load: () => Promise<{ ok: true; data: InsightsData } | { ok: false; error: string }>) {
  const [state, setState] = useState<{ data?: InsightsData; error?: string }>({});
  useEffect(() => {
    let live = true;
    load().then(
      (r) => live && setState(r.ok ? { data: r.data } : { error: r.error }),
      () => live && setState({ error: "Couldn't load insights. Try again." }),
    );
    return () => {
      live = false;
    };
  }, [load]);
  return state;
}
