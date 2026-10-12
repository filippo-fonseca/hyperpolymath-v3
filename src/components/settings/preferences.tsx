"use client";

import { useMemo } from "react";
import { setTimezoneAction } from "@/app/actions/settings";
import { fieldClass } from "@/components/ui/primitives";
import { useDashboard } from "@/components/dashboard/context";
import { Section } from "./shared";

export function PreferencesSection() {
  const { data, run } = useDashboard();
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [data.tz];
    }
  }, [data.tz]);
  const list = zones.includes(data.tz) ? zones : [data.tz, ...zones];
  return (
    <Section id="settings-timezone" title="Timezone" hint="Today, habit days and reminder times follow this. Switch it when you travel.">
      <select
        id="settings-timezone-select"
        value={data.tz}
        onChange={(e) => void run(setTimezoneAction(e.target.value), { success: `Timezone set to ${e.target.value.replace(/_/g, " ")}` })}
        className={`${fieldClass} w-full appearance-none`}
        aria-labelledby="settings-timezone-title"
      >
        {list.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </Section>
  );
}
