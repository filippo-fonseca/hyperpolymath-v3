"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/format";
import { listTokensAction, mintTokenAction, revokeTokenAction } from "@/app/actions/settings";
import { Button, fieldClass } from "@/components/ui/primitives";
import { IconChevronRight, IconPlus } from "@/components/ui/icons";
import { useDashboard } from "@/components/dashboard/context";
import { CopyButton, Section, type SectionProps } from "./shared";

type Token = { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };

export function GrokBotSection(props: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <McpSection {...props} />
      <TeammatesSection />
    </div>
  );
}

/* ---------------- MCP ---------------- */

function McpSection({ reloadOverview }: SectionProps) {
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
    reloadOverview();
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

/* ---------------- Teammates ---------------- */

function TeammatesSection() {
  const { data, openTeammates } = useDashboard();
  const paused = data.routines.filter((r) => !r.enabled).length;
  return (
    <Section title="Teammates and routines" hint="Edit your bots, and pause or resume the routines they run in Grok Bot.">
      <button
        type="button"
        onClick={() => openTeammates()}
        className="flex w-full items-center justify-between gap-3 rounded-[14px] bg-gray-100 px-3.5 py-3 text-left transition hover:bg-gray-150"
      >
        <span className="text-[14px] font-medium">
          {data.bots.length} {data.bots.length === 1 ? "teammate" : "teammates"} · {data.routines.length}{" "}
          {data.routines.length === 1 ? "routine" : "routines"}
          {paused > 0 && <span className="font-normal text-ink-3"> ({paused} paused)</span>}
        </span>
        <IconChevronRight size={16} className="shrink-0 text-gray-500" />
      </button>
    </Section>
  );
}

