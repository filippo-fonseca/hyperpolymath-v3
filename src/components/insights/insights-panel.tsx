"use client";

import { insightsAction } from "@/app/actions/widgets";
import { INSIGHT_RANGES, type InsightRange } from "@/lib/insights";
import { useDashboard } from "@/components/dashboard/context";
import { useViewMode } from "@/components/dashboard/use-view";
import { InsightsSkeleton, InsightsView, useInsights } from "./insights-view";

const RANGES = INSIGHT_RANGES.map(String) as `${InsightRange}`[];

/** The Insights full view (?view=insights). The range lives in the URL (&mode=7). */
export function InsightsPanel() {
  const { nowMs } = useDashboard();
  const [mode, setMode] = useViewMode(RANGES, "30");
  const state = useInsights(insightsAction);
  if (state.error) return <p className="py-16 text-center text-[14px] text-ink-3">{state.error}</p>;
  if (!state.data) return <InsightsSkeleton />;
  return <InsightsView data={state.data} nowMs={nowMs} range={Number(mode) as InsightRange} onRange={(r) => setMode(String(r) as `${InsightRange}`)} />;
}
