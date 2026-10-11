"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import type { CalendarAccount, CalendarData } from "@/lib/dashboard-types";
import type { CalendarInfo } from "@/server/google/calendar";
import { relativeTime } from "@/lib/format";
import { listTokensAction, mintTokenAction, revokeTokenAction, setTimezoneAction } from "@/app/actions/settings";
import { disconnectGoogleAction, listCalendarsAction, setCalendarsAction } from "@/app/actions/calendar";
import { signOut } from "@/app/actions/auth";
import { Button, Sheet, fieldClass } from "@/components/ui/primitives";
import { IconCheck, IconCopy, IconPlus, IconSignOut } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useDashboard } from "./context";

type Token = { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Settings" width={520}>
      {open && (
        <div className="flex flex-col gap-8 pb-3">
          <TimezoneSection />
          <McpSection />
          <Suspense fallback={<Section title="Google Calendar"><div className="skeleton h-12 rounded-[14px]" /></Section>}>
            <GoogleSection />
          </Suspense>
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="-ml-2 text-ink-2">
              <IconSignOut size={16} /> Sign out
            </Button>
          </form>
        </div>
      )}
    </Sheet>
  );
}

function Section({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="soft"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked; the text is selectable */
        }
      }}
    >
      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/* ---------------- Timezone ---------------- */

function TimezoneSection() {
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
    <Section title="Timezone" hint="Today, habit days and reminder times follow this.">
      <select
        value={data.tz}
        onChange={(e) => void run(setTimezoneAction(e.target.value), { success: `Timezone set to ${e.target.value.replace(/_/g, " ")}` })}
        className={`${fieldClass} w-full appearance-none`}
        aria-label="Timezone"
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

/* ---------------- MCP ---------------- */

function McpSection() {
  const { run, nowMs } = useDashboard();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState("Grok Bot");
  const [fresh, setFresh] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setOrigin(window.location.origin), 0);
    let live = true;
    void run(listTokensAction()).then((t) => {
      if (live) setTokens(t ?? []);
    });
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [run]);

  const reload = async () => {
    const t = await run(listTokensAction());
    if (t) setTokens(t);
  };
  const url = `${origin}/api/mcp`;

  return (
    <Section title="Grok Bot connection" hint="Add this MCP server in Grok Bot with an Authorization header: Bearer <token>.">
      <div className="flex items-center gap-2 rounded-[14px] bg-gray-100 py-1.5 pl-3.5 pr-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{url}</code>
        <CopyButton text={url} />
      </div>

      {fresh && (
        <div className="mt-3 rounded-[14px] bg-accent-soft p-3.5">
          <p className="text-[13px] font-medium text-accent-hover">Copy this token now. It won&apos;t be shown again.</p>
          <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-white py-1.5 pl-3 pr-1.5">
            <code className="min-w-0 flex-1 break-all font-mono text-[12.5px]">{fresh}</code>
            <CopyButton text={fresh} />
          </div>
          <button type="button" className="mt-2 text-[12.5px] font-medium text-accent-hover hover:underline" onClick={() => setFresh(null)}>
            I&apos;ve saved it
          </button>
        </div>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = await run(mintTokenAction(name));
          if (t) {
            setFresh(t.token);
            void reload();
          }
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" maxLength={60} className={`${fieldClass} flex-1`} aria-label="Token name" />
        <Button type="submit" variant="dark" className="shrink-0">
          <IconPlus size={15} /> New token
        </Button>
      </form>

      <ul className="mt-3 divide-y divide-gray-150">
        {tokens === null && <li className="skeleton my-2 h-10 rounded-[12px]" />}
        {tokens?.length === 0 && <li className="py-2 text-[13px] text-ink-3">No tokens yet.</li>}
        {tokens?.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className={`text-[14px] font-medium ${t.revoked_at ? "text-ink-3 line-through" : ""}`}>{t.name}</div>
              <div className="text-[12.5px] text-gray-500">
                <code className="font-mono">{t.prefix}…</code> · {t.last_used_at ? `used ${relativeTime(t.last_used_at, nowMs)}` : "never used"}
              </div>
            </div>
            {t.revoked_at ? (
              <span className="rounded-full bg-gray-150 px-2 py-0.5 text-[11.5px] font-medium text-gray-600">Revoked</span>
            ) : confirmId === t.id ? (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    setConfirmId(null);
                    const ok = await run(revokeTokenAction(t.id), { success: "Token revoked" });
                    if (ok) void reload();
                  }}
                >
                  Revoke
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmId(t.id)}>
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------------- Google ---------------- */

function GoogleSection() {
  const { calendar, run } = useDashboard();
  const cal: CalendarData = use(calendar);
  const [calendars, setCalendars] = useState<CalendarInfo[] | null>(null);

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
      <Section title="Google Calendar">
        <p className="text-[13.5px] text-ink-3">Google isn&apos;t configured on this deployment.</p>
      </Section>
    );
  }

  return (
    <Section title="Google Calendar" hint="Choose which calendars show on the dashboard and where new events go.">
      <div className="flex flex-col gap-4">
        {cal.accounts.map((a) => (
          <AccountCard key={a.id} account={a} calendars={calendars?.filter((c) => c.account_id === a.id) ?? null} />
        ))}
        <a
          href="/api/google/connect"
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-full bg-gray-150 px-3.5 text-[13px] font-medium transition hover:bg-gray-200"
        >
          <IconPlus size={14} /> {cal.accounts.length ? "Connect another account" : "Connect Google Calendar"}
        </a>
      </div>
    </Section>
  );
}

function AccountCard({ account, calendars }: { account: CalendarAccount; calendars: CalendarInfo[] | null }) {
  const { run } = useDashboard();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [shown, setShown] = useState<string[] | null>(null);
  const [def, setDef] = useState<string | null>(null);
  const shownIds = shown ?? calendars?.filter((c) => c.shown).map((c) => c.id) ?? [];
  const defaultId = def ?? calendars?.find((c) => c.is_default)?.id ?? "";

  const toggle = async (id: string) => {
    const next = shownIds.includes(id) ? shownIds.filter((x) => x !== id) : [...shownIds, id];
    if (!next.length) {
      toast.error("Keep at least one calendar visible.");
      return;
    }
    setShown(next);
    const ok = await run(setCalendarsAction(account.id, { calendar_ids: next }));
    if (!ok) setShown(null);
  };

  return (
    <div className="rounded-[16px] bg-gray-50 p-3.5 shadow-ring">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{account.email}</span>
        {confirm ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Keep
            </Button>
            <Button size="sm" variant="danger" onClick={() => run(disconnectGoogleAction(account.id), { success: "Disconnected" })}>
              Disconnect
            </Button>
          </>
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
        <>
          <ul className="mt-2">
            {calendars.map((c) => {
              const on = shownIds.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 py-1.5">
                    <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="sr-only" />
                    <span
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] text-white transition"
                      style={{ background: on ? (c.color ?? "var(--accent)") : "transparent", boxShadow: on ? undefined : "inset 0 0 0 1.5px var(--gray-400)" }}
                    >
                      {on && <IconCheck size={12} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px]">{c.name}</span>
                    {c.primary && <span className="text-[11.5px] text-ink-3">primary</span>}
                  </label>
                </li>
              );
            })}
          </ul>
          <label className="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
            New events go to
            <select
              value={defaultId}
              onChange={async (e) => {
                const v = e.target.value;
                setDef(v);
                const ok = await run(setCalendarsAction(account.id, { default_calendar_id: v }));
                if (!ok) setDef(null);
              }}
              className="h-8 min-w-0 flex-1 appearance-none rounded-[10px] bg-white px-2.5 text-[13px] text-ink shadow-ring outline-none"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
