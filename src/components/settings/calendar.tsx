"use client";

import { Suspense, use, useEffect, useState } from "react";
import type { CalendarAccount, CalendarData } from "@/lib/dashboard-types";
import type { CalendarInfo } from "@/server/google/calendar";
import { disconnectGoogleAction, listCalendarsAction, setCalendarsAction, setDefaultCalendarAction } from "@/app/actions/calendar";
import { Button, Switch } from "@/components/ui/primitives";
import { IconCheck, IconPlus } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { useToast } from "@/components/ui/toast";
import { useDashboard } from "@/components/dashboard/context";
import { DOCS, DocLink, Section } from "./shared";

export function CalendarSection() {
  return (
    <Suspense
      fallback={
        <Section title="Google Calendar">
          <div className="flex h-24 items-center justify-center">
            <KiwiLoader size={36} label="Loading calendars" />
          </div>
        </Section>
      }
    >
      <GoogleSection />
    </Suspense>
  );
}

function GoogleSection() {
  const { calendar, run } = useDashboard();
  const cal: CalendarData = use(calendar);
  const [calendars, setCalendars] = useState<CalendarInfo[] | null>(null);
  const [defaultKey, setDefaultKey] = useState<string | null>(null);

  useEffect(() => {
    if (!cal.accounts.length) return;
    let live = true;
    void run(listCalendarsAction(), { quiet: true }).then((c) => {
      if (live) setCalendars(c ?? []);
    });
    return () => {
      live = false;
    };
  }, [cal, run]);

  if (!cal.configured && !cal.accounts.length) {
    return (
      <Section id="settings-google" title="Google Calendar">
        <p className="text-[13.5px] leading-relaxed text-ink-3">
          Google isn&apos;t configured on this deployment yet. Add an OAuth client as described in <DocLink href={DOCS.google}>the deploy guide</DocLink>,
          then connect here.
        </p>
      </Section>
    );
  }

  const keyOf = (c: CalendarInfo) => `${c.account_id}|${c.id}`;
  const current = defaultKey ?? (calendars?.find((c) => c.is_default) ? keyOf(calendars.find((c) => c.is_default)!) : "");

  return (
    <Section id="settings-google" title="Google Calendar" hint="Connect as many accounts as you like. Switch an account off to hide it without disconnecting.">
      <div className="flex flex-col gap-4">
        {cal.accounts.length > 0 && calendars && calendars.length > 0 && (
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            New events go to
            <select
              value={current}
              onChange={async (e) => {
                const v = e.target.value;
                const [accountId, calendarId] = [v.slice(0, v.indexOf("|")), v.slice(v.indexOf("|") + 1)];
                setDefaultKey(v);
                const ok = await run(setDefaultCalendarAction(accountId, calendarId), { success: "Default calendar updated" });
                if (!ok) setDefaultKey(null);
              }}
              className="h-10 w-full appearance-none rounded-[12px] bg-white px-3 text-[14px] text-ink shadow-ring outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {cal.accounts.map((a) => (
                <optgroup key={a.id} label={a.email}>
                  {calendars
                    .filter((c) => c.account_id === a.id)
                    .map((c) => (
                      <option key={keyOf(c)} value={keyOf(c)}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        {cal.accounts.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            isDefault={current ? current.startsWith(`${a.id}|`) : a.is_default}
            calendars={calendars?.filter((c) => c.account_id === a.id) ?? null}
          />
        ))}
        <a
          id="settings-google-connect"
          href="/api/google/connect"
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-full bg-gray-150 px-3.5 text-[13px] font-medium transition hover:bg-gray-200"
        >
          <IconPlus size={14} /> {cal.accounts.length ? "Connect another account" : "Connect Google Calendar"}
        </a>
      </div>
    </Section>
  );
}

function AccountCard({
  account,
  isDefault,
  calendars,
}: {
  account: CalendarAccount;
  isDefault: boolean;
  calendars: CalendarInfo[] | null;
}) {
  const { run } = useDashboard();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [shown, setShown] = useState<string[] | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const on = enabled ?? account.enabled;
  const shownIds = shown ?? calendars?.filter((c) => c.shown).map((c) => c.id) ?? [];

  const toggle = async (id: string) => {
    const next = shownIds.includes(id) ? shownIds.filter((x) => x !== id) : [...shownIds, id];
    if (!next.length) {
      toast.error("Keep at least one calendar visible, or switch the account off.");
      return;
    }
    setShown(next);
    const ok = await run(setCalendarsAction(account.id, { calendar_ids: next }));
    if (!ok) setShown(null);
  };

  const setAccountOn = async (next: boolean) => {
    if (!next && isDefault) {
      toast.error("New events go to this account. Pick another default first.");
      return;
    }
    setEnabled(next);
    const ok = await run(setCalendarsAction(account.id, { enabled: next }), {
      success: next ? "Account shown" : "Account hidden",
    });
    if (!ok) setEnabled(null);
  };

  return (
    <div className="rounded-[16px] bg-gray-50 p-3.5 shadow-ring">
      <div className="flex flex-wrap items-center gap-2.5">
        <Switch checked={on} onChange={setAccountOn} label={`Show ${account.email}`} />
        <span className={`min-w-0 flex-1 truncate text-[14px] font-medium ${on ? "" : "text-ink-3"}`}>{account.email}</span>
        {isDefault && <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11.5px] font-medium text-accent">Default</span>}
        {confirm ? (
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Keep
            </Button>
            <Button size="sm" variant="danger" onClick={() => run(disconnectGoogleAction(account.id), { success: "Disconnected" })}>
              Disconnect
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
            Disconnect
          </Button>
        )}
      </div>
      {calendars === null ? (
        <div className="skeleton mt-3 h-8 rounded-[10px]" />
      ) : calendars.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-3">Couldn&apos;t load calendars for this account.</p>
      ) : (
        <ul className={`mt-2 transition-opacity ${on ? "" : "pointer-events-none opacity-40"}`}>
          {calendars.map((c) => {
            const shownOn = shownIds.includes(c.id);
            return (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-[8px] py-1.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
                  <input type="checkbox" checked={shownOn} onChange={() => toggle(c.id)} className="sr-only" />
                  <span
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] text-white transition"
                    style={{
                      background: shownOn ? (c.color ?? "var(--accent)") : "transparent",
                      boxShadow: shownOn ? undefined : "inset 0 0 0 1.5px var(--gray-400)",
                    }}
                  >
                    {shownOn && <IconCheck size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{c.name}</span>
                  {c.primary && <span className="text-[11.5px] text-ink-3">primary</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
