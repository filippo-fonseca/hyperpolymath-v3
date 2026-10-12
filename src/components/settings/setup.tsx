"use client";

import type { ReactNode } from "react";
import type { SetupStatus } from "@/server/status";
import { relativeTime } from "@/lib/format";
import { IconCheck } from "@/components/ui/icons";
import { KiwiTeam } from "@/components/illustrations";
import { useDashboard } from "@/components/dashboard/context";
import { DOCS, DocLink, OverviewPending, type SectionProps } from "./shared";

/** The pg_cron tick runs every 5 minutes; this long without one means it stopped. */
const TICK_STALE_MS = 20 * 60_000;

type State = "done" | "warn" | "todo";
type Item = { key: string; title: string; state: State; detail: ReactNode; action?: ReactNode };

const actionClass =
  "inline-flex h-8 items-center rounded-full bg-gray-150 px-3 text-[13px] font-medium text-ink transition hover:bg-gray-200 active:scale-[0.97]";

export function SetupSection({ overview, overviewFailed, reloadOverview, go }: SectionProps) {
  const { nowMs } = useDashboard();
  if (!overview) return <OverviewPending failed={overviewFailed} retry={reloadOverview} label="Checking setup" />;

  const s: SetupStatus = overview.status;
  const tickAge = s.relay.last_tick_at ? nowMs - Date.parse(s.relay.last_tick_at) : null;
  const ago = (iso: string | null) => relativeTime(iso, nowMs);

  const items: Item[] = [
    {
      key: "signin",
      title: "Signed in",
      state: "done",
      detail: overview.email ? <span className="break-all">{overview.email}</span> : "Owner session active",
    },
    s.mcp.tokens === 0
      ? {
          key: "mcp",
          title: "Create an MCP token",
          state: "todo",
          detail: "Grok Bot uses it to read and write your dashboard.",
          action: (
            <button type="button" className={actionClass} onClick={() => go("grokbot", "settings-token-name")}>
              Create a token
            </button>
          ),
        }
      : s.mcp.last_used_at
        ? { key: "mcp", title: "MCP token in use", state: "done", detail: `Last used ${ago(s.mcp.last_used_at)}` }
        : {
            key: "mcp",
            title: "Add the token in Grok Bot",
            state: "warn",
            detail: "A token exists but hasn't been used yet.",
            action: (
              <button type="button" className={actionClass} onClick={() => go("grokbot", "settings-connect-message")}>
                How to connect
              </button>
            ),
          },
    s.kiwi.connected
      ? {
          key: "kiwi",
          title: `${s.kiwi.name ?? "Kiwi"} is connected`,
          state: "done",
          detail: s.kiwi.last_seen_at ? `Last seen ${ago(s.kiwi.last_seen_at)}` : "Registered as coordinator",
        }
      : {
          key: "kiwi",
          title: "Connect Kiwi",
          state: "todo",
          detail: "Kiwi hasn't reported for duty yet. Name your coordinator bot Kiwi and give it the standing prompt.",
          action: <DocLink href={DOCS.kiwiSetup} className="text-[13px]">Setup guide</DocLink>,
        },
    !s.relay.configured
      ? {
          key: "relay",
          title: "Set up the reminder relay",
          state: "todo",
          detail: "Reminders reach you through a Kiwi webhook routine. Add its URL and key to the app's environment.",
          action: <DocLink href={DOCS.relay} className="text-[13px]">Relay guide</DocLink>,
        }
      : s.relay.failing.count > 0
        ? {
            key: "relay",
            title: `${s.relay.failing.count} ${s.relay.failing.count === 1 ? "reminder is" : "reminders are"} failing`,
            state: "warn",
            detail: s.relay.failing.last_error ?? "Delivery to Kiwi failed. It retries every tick.",
            action: (
              <button type="button" className={actionClass} onClick={() => go("reminders")}>
                Details
              </button>
            ),
          }
        : tickAge === null || tickAge > TICK_STALE_MS
          ? {
              key: "relay",
              title: "Reminder checks aren't running",
              state: "warn",
              detail: s.relay.last_tick_at ? `Last check ${ago(s.relay.last_tick_at)}. It should run every 5 minutes.` : "No check has run yet. Point the database cron at the app.",
              action: <DocLink href={DOCS.deploy} className="text-[13px]">Deploy guide</DocLink>,
            }
          : { key: "relay", title: "Reminder relay is healthy", state: "done", detail: `Last check ${ago(s.relay.last_tick_at)}` },
    s.google.accounts > 0
      ? {
          key: "google",
          title: "Google Calendar connected",
          state: "done",
          detail: `${s.google.accounts} ${s.google.accounts === 1 ? "account" : "accounts"}`,
        }
      : s.google.configured
        ? {
            key: "google",
            title: "Connect Google Calendar",
            state: "todo",
            detail: "See events beside your tasks, and let Kiwi add them.",
            action: (
              <button type="button" className={actionClass} onClick={() => go("calendar", "settings-google-connect")}>
                Connect Google
              </button>
            ),
          }
        : {
            key: "google",
            title: "Google Calendar isn't configured",
            state: "todo",
            detail: "This deployment needs a Google OAuth client first.",
            action: <DocLink href={DOCS.google} className="text-[13px]">Calendar setup</DocLink>,
          },
  ];

  const done = items.filter((i) => i.state === "done").length;
  const allDone = done === items.length;

  return (
    <section aria-labelledby="settings-setup-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h4 id="settings-setup-title" className="text-[15px] font-semibold">
            {allDone ? "All set" : "Finish setting up"}
          </h4>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {done} of {items.length} done
          </p>
        </div>
        {!s.kiwi.connected && (
          <span className="-mb-1 -mr-1 shrink-0" aria-hidden>
            <KiwiTeam size={84} />
          </span>
        )}
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-150"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={done}
        aria-label="Setup progress"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="mt-4 overflow-hidden rounded-[16px] bg-gray-50 shadow-ring">
        {items.map((item, i) => (
          <li key={item.key} className={`flex gap-3 px-3.5 py-3 ${i ? "border-t border-gray-150" : ""}`}>
            <StateMark state={item.state} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium leading-snug">{item.title}</div>
              <div className={`mt-0.5 text-[13px] leading-snug ${item.state === "warn" ? "text-[#a35f00]" : "text-ink-3"}`}>{item.detail}</div>
              {item.action && <div className="mt-2">{item.action}</div>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StateMark({ state }: { state: State }) {
  const label = state === "done" ? "Done" : state === "warn" ? "Needs attention" : "To do";
  return (
    <span className="mt-px shrink-0" role="img" aria-label={label}>
      {state === "done" ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-white">
          <IconCheck size={13} strokeWidth={3} />
        </span>
      ) : state === "warn" ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fff1d6] text-[12px] font-bold text-[#a35f00]">!</span>
      ) : (
        <span className="block h-5 w-5 rounded-full shadow-[inset_0_0_0_1.5px_var(--gray-300)]" />
      )}
    </span>
  );
}
