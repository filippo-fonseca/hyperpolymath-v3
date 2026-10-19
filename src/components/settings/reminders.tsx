"use client";

import { useState } from "react";
import { relativeTime } from "@/lib/format";
import { clearRelayAction, setRelayAction } from "@/app/actions/settings";
import { useDashboard } from "@/components/dashboard/context";
import { Button, fieldClass } from "@/components/ui/primitives";
import { DOCS, DocLink, Dot, InfoRow, OverviewPending, Section, cardClass, type SectionProps } from "./shared";

/** The pg_cron tick runs every 5 minutes; this long without one means it stopped. */
const TICK_STALE_MS = 20 * 60_000;

export function RemindersSection({ overview, overviewFailed, reloadOverview }: SectionProps) {
  const { data, nowMs } = useDashboard();
  const hint = "Every 5 minutes the app batches due reminders into one webhook to your Kiwi, who nudges you in Grok Bot. Reply “done” and they stop.";

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
              {relay.configured ? (relay.source === "env" ? `Server default (${relay.host})` : relay.host) : "Not set up"}
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
            Reminders are saved but nothing delivers them yet. Create the Reminder relay routine in Grok Bot, then paste its webhook URL and key
            below: <DocLink href={DOCS.relay}>relay guide</DocLink>.
          </p>
        )}
        <RelayForm source={relay.source} onSaved={reloadOverview} />
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

/** This account's own relay webhook. The key is write-only: it's never shown again. */
function RelayForm({ source, onSaved }: { source: "account" | "env" | null; onSaved: () => void }) {
  const { run } = useDashboard();
  const [editing, setEditing] = useState(source === null);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await run(setRelayAction({ url, token }), { success: "Relay saved" });
    setBusy(false);
    if (res) {
      setUrl("");
      setToken("");
      setEditing(false);
      onSaved();
    }
  };
  const remove = async () => {
    setBusy(true);
    const res = await run(clearRelayAction(), { success: "Relay removed" });
    setBusy(false);
    if (res) onSaved();
  };

  if (!editing) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setEditing(true)}>
          {source === "account" ? "Change webhook" : "Use my own webhook"}
        </Button>
        {source === "account" && (
          <Button size="sm" variant="ghost" onClick={remove} disabled={busy} className="text-ink-2">
            Remove
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mt-4 flex flex-col gap-2">
      <label htmlFor="relay-url" className="text-[13px] font-medium text-ink-2">
        Webhook URL
      </label>
      <input
        id="relay-url"
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://api2.cursor.sh/automations/webhook/..."
        autoComplete="off"
        spellCheck={false}
        className={fieldClass}
      />
      <label htmlFor="relay-token" className="mt-1 text-[13px] font-medium text-ink-2">
        Webhook key
      </label>
      <input
        id="relay-token"
        type="password"
        required
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="crsr_..."
        autoComplete="off"
        spellCheck={false}
        className={fieldClass}
      />
      <p className="text-[12.5px] text-ink-3">Stored encrypted and only used to send your reminders. You won&apos;t see the key again.</p>
      <div className="mt-1 flex gap-2">
        <Button type="submit" size="sm" variant="dark" disabled={busy || !url || !token}>
          Save relay
        </Button>
        {source !== null && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} className="text-ink-2">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
