"use client";

import { useState } from "react";
import { exportAllAction } from "@/app/actions/status";
import { Button } from "@/components/ui/primitives";
import { IconArrowUp } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { useDashboard } from "@/components/dashboard/context";
import { InfoRow, OverviewPending, Section, cardClass, type SectionProps } from "./shared";

const COUNT_LABELS = [
  ["tasks", "Tasks"],
  ["projects", "Projects"],
  ["habits", "Habits"],
  ["captures", "Captures"],
  ["bots", "Teammates"],
  ["routines", "Routines"],
] as const;

export function DataSection({ overview, overviewFailed, reloadOverview }: SectionProps) {
  const { data, run } = useDashboard();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setDone(null);
    const json = await run(exportAllAction());
    setBusy(false);
    if (!json) return;
    const filename = `hyperpolymath-export-${data.today}.json`;
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    setDone(filename);
  };

  return (
    <div className="flex flex-col gap-8">
      <Section
        id="settings-export"
        title="Export everything"
        hint="One JSON file with your tasks, projects, habits, captures, reminders, widgets, teammates, routines and the full activity log. Tokens and Google credentials are left out."
      >
        <Button variant="dark" onClick={download} disabled={busy}>
          {busy ? <KiwiLoader size={20} label="Preparing export" /> : <IconArrowUp size={15} className="rotate-180" />}
          {busy ? "Preparing…" : "Download JSON"}
        </Button>
        <p className="mt-2 min-h-[18px] text-[12.5px] text-ink-3" aria-live="polite">
          {done ? `Saved ${done}` : ""}
        </p>
      </Section>

      <Section title="What's stored" hint="Live counts, excluding archived and deleted items.">
        {overview ? (
          <dl className={`${cardClass} grid grid-cols-1 divide-y divide-gray-150 min-[420px]:grid-cols-2 min-[420px]:gap-x-6 min-[420px]:divide-y-0`}>
            {COUNT_LABELS.map(([key, label]) => (
              <InfoRow key={key} label={label}>
                <span className="tabular-nums">{overview.status.counts[key].toLocaleString()}</span>
              </InfoRow>
            ))}
          </dl>
        ) : (
          <OverviewPending failed={overviewFailed} retry={reloadOverview} label="Counting" />
        )}
      </Section>
    </div>
  );
}
