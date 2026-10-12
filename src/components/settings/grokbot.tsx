"use client";

import { useEffect, useState, type ReactNode } from "react";
import { relativeTime } from "@/lib/format";
import { listTokensAction, mintTokenAction, revokeTokenAction } from "@/app/actions/settings";
import { Button, fieldClass } from "@/components/ui/primitives";
import { IconCheck, IconChevronRight, IconPlus } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { useDashboard } from "@/components/dashboard/context";
import { CopyButton, DOCS, DocLink, Section, type SectionProps } from "./shared";

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

function connectMessage(url: string, token: string | null) {
  return `Add a custom MCP server named "Hyperpolymath". URL: ${url}. Header: Authorization: Bearer ${token ?? "<paste your token>"}. Store the token as a secret, then call get_overview to confirm it works.`;
}

function McpSection({ reloadOverview }: SectionProps) {
  const { run, nowMs } = useDashboard();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState("Grok Bot");
  const [fresh, setFresh] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"mint" | string | null>(null);
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
  const live = tokens?.filter((t) => !t.revoked_at) ?? [];

  const mint = async () => {
    setBusy("mint");
    const t = await run(mintTokenAction(name.trim() || "Grok Bot"));
    setBusy(null);
    if (t) {
      setFresh(t.token);
      void reload();
    }
  };

  const revoke = async (id: string) => {
    setBusy(id);
    const ok = await run(revokeTokenAction(id), { success: "Token revoked" });
    setBusy(null);
    setConfirmId(null);
    if (ok) void reload();
  };

  return (
    <>
      <Section title="MCP server" hint="Grok Bot reads and writes your dashboard through this address.">
        <div className="flex items-center gap-2 rounded-[14px] bg-gray-100 py-1.5 pl-3.5 pr-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{url}</code>
          <CopyButton text={url} srLabel="Copy MCP server URL" />
        </div>
      </Section>

      <Section title="Tokens" hint="Each token works as a bearer key for the MCP server and the capture endpoint. Revoke one any time.">
        {fresh && (
          <div className="mb-3 rounded-[14px] bg-accent-soft p-3.5" role="status">
            <p className="text-[13px] font-medium text-accent-hover">Copy this token now. It won&apos;t be shown again.</p>
            <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-white py-1.5 pl-3 pr-1.5">
              <code className="min-w-0 flex-1 break-all font-mono text-[12.5px]">{fresh}</code>
              <CopyButton text={fresh} srLabel="Copy token" />
            </div>
            <button type="button" className="mt-2 text-[12.5px] font-medium text-accent-hover hover:underline" onClick={() => setFresh(null)}>
              I&apos;ve saved it
            </button>
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void mint();
          }}
        >
          <input
            id="settings-token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Token name"
            maxLength={60}
            className={`${fieldClass} flex-1`}
            aria-label="New token name"
          />
          <Button type="submit" variant="dark" className="shrink-0" disabled={busy === "mint"}>
            {busy === "mint" ? <KiwiLoader size={18} label="Creating token" /> : <IconPlus size={15} />} New token
          </Button>
        </form>

        <ul className="mt-3 divide-y divide-gray-150" aria-busy={tokens === null}>
          {tokens === null && <li className="skeleton my-2 h-10 rounded-[12px]" />}
          {tokens?.length === 0 && <li className="py-2 text-[13px] text-ink-3">No tokens yet.</li>}
          {tokens?.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[14px] font-medium ${t.revoked_at ? "text-ink-3 line-through" : ""}`}>{t.name}</div>
                <div className="text-[12.5px] text-gray-500">
                  <code className="font-mono">{t.prefix}…</code> · {t.last_used_at ? `used ${relativeTime(t.last_used_at, nowMs)}` : "never used"}
                </div>
              </div>
              {t.revoked_at ? (
                <span className="rounded-full bg-gray-150 px-2 py-0.5 text-[11.5px] font-medium text-gray-600">Revoked</span>
              ) : confirmId === t.id ? (
                <div className="flex items-center gap-1" role="group" aria-label={`Revoke ${t.name}?`}>
                  <span className="mr-1 text-[12.5px] text-ink-3">Bots using it lose access.</span>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)} autoFocus>
                    Keep
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void revoke(t.id)} disabled={busy === t.id}>
                    {busy === t.id ? "Revoking…" : "Revoke"}
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmId(t.id)} aria-label={`Revoke ${t.name}`}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <section aria-labelledby="settings-connect-message">
        <h4 id="settings-connect-message" tabIndex={-1} className="text-[15px] font-semibold outline-none">
          How to connect Grok Bot
        </h4>
        <ol className="mt-3 flex flex-col gap-3 text-[13.5px] leading-snug text-ink-2">
          <Step n={1} done={live.length > 0}>
            Create a token above and copy it.
          </Step>
          <Step n={2}>
            In any Grok Bot chat, send this message{fresh ? " (it already includes your new token)" : ", with your token pasted in"}:
            <div className="mt-2 rounded-[14px] bg-gray-100 p-3">
              <p className="select-all break-words font-mono text-[12.5px] leading-relaxed text-ink">{connectMessage(url, fresh)}</p>
              <div className="mt-2.5 flex justify-end">
                <CopyButton text={connectMessage(url, fresh)} label="Copy message" />
              </div>
            </div>
          </Step>
          <Step n={3}>
            MCP servers apply to every bot on your account, so this is done once. Then set up Kiwi with the{" "}
            <DocLink href={DOCS.grokbot}>Grok Bot setup guide</DocLink>.
          </Step>
        </ol>
      </section>
    </>
  );
}

function Step({ n, done, children }: { n: number; done?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold ${
          done ? "bg-success text-white" : "bg-gray-150 text-ink-2"
        }`}
      >
        {done ? <IconCheck size={12} strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
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

