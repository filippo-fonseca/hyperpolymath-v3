"use client";

import { relativeTime } from "@/lib/format";
import { useDashboard } from "@/components/dashboard/context";
import { DOCS, DocLink, Dot, InfoRow, OverviewPending, Section, cardClass, type SectionProps } from "./shared";

/** The pg_cron tick runs every 5 minutes; this long without one means it stopped. */
const TICK_STALE_MS = 20 * 60_000;

export function RemindersSection({ overview, overviewFailed, reloadOverview }: SectionProps) {
  const { data, nowMs } = useDashboard();
  const hint = "Every 5 minutes the app batches due reminders into one webhook to Kiwi, who nudges you in Grok Bot. Reply “done” and they stop.";

  if (!overview) {
    return (
      <Section id="settings-reminders" title="Delivery" hint={hint}>
        <OverviewPending failed={overviewFailed} retry={reloadOverview} label="Checking delivery" />
      </Section>
    );
  }

  const { relay } = overview.status;
  const tickAge = relay.last_tick_at ? nowMs - Date.parse(relay.last_tick_at) : null;
  const ticking = tickAge !== null && tickAge <= TICK_STALE_MS;
  const failing = data.reminders.filter((r) => r.last_error);
  const next = data.reminders.find((r) => r.next_fire_at);
  const label = (r: (typeof data.reminders)[number]) => r.task?.title ?? r.message ?? "Reminder";

  return (
    <div className="flex flex-col gap-8">
      <Section id="settings-reminders" title="Delivery" hint={hint}>
        <dl className={`${cardClass} divide-y divide-gray-150`}>
          <InfoRow label="Relay to Kiwi">
            <span className="inline-flex items-center gap-2">
              <Dot tone={relay.configured ? "ok" : "off"} />
              {relay.configured ? "Configured" : "Not configured"}
            </span>
          </InfoRow>
          <InfoRow label="Last check">
            <span className="inline-flex items-center gap-2">
              <Dot tone={ticking ? "ok" : "warn"} />
              {relay.last_tick_at ? relativeTime(relay.last_tick_at, nowMs) : "Never"}
            </span>
          </InfoRow>
          <InfoRow label="Failing">
            <span className="inline-flex items-center gap-2">
              <Dot tone={relay.failing.count ? "warn" : "ok"} />
              {relay.failing.count ? `${relay.failing.count} ${relay.failing.count === 1 ? "reminder" : "reminders"}` : "None"}
            </span>
          </InfoRow>
          <InfoRow label="Active reminders">
            {data.reminders.length}
            {next?.next_fire_at && <span className="font-normal text-ink-3"> · next {relativeTime(next.next_fire_at, nowMs)}</span>}
          </InfoRow>
        </dl>

        {!relay.configured && (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
            Reminders are saved but nothing delivers them yet. Create the Reminder relay routine in Grok Bot and add its URL and key to the app&apos;s
            environment: <DocLink href={DOCS.relay}>relay guide</DocLink>.
          </p>
        )}
        {relay.configured && !ticking && (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
            The scheduled check hasn&apos;t run recently, so nothing is being sent. Point the database cron job at this app:{" "}
            <DocLink href={DOCS.deploy}>deploy guide</DocLink>.
          </p>
        )}
      </Section>

      {relay.failing.count > 0 && (
        <Section title="Failing reminders" hint="Each one retries on the next check. Fix the cause and they deliver on their own.">
          {relay.failing.last_error && (
            <p className="rounded-[12px] bg-[#fff6e5] px-3.5 py-2.5 text-[13px] leading-snug text-[#7a4700]">
              <span className="font-medium">Last error:</span> <span className="break-words">{relay.failing.last_error}</span>
            </p>
          )}
          {failing.length > 0 && (
            <ul className="mt-3 divide-y divide-gray-150">
              {failing.map((r) => (
                <li key={r.id} className="py-2.5">
                  <div className="truncate text-[14px] font-medium">{label(r)}</div>
                  <div className="break-words text-[12.5px] text-ink-3">{r.last_error}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}
