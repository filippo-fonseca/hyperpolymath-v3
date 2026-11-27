"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { relativeTime } from "@/lib/format";
import { listTokensAction, mintTokenAction, revokeTokenAction } from "@/app/actions/settings";
import { disconnectAppAction, listConnectedAppsAction } from "@/app/actions/oauth";
import { Button, Segmented, fieldClass } from "@/components/ui/primitives";
import { IconCheck, IconChevronRight, IconPlus } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { useDashboard } from "@/components/dashboard/context";
import { CopyButton, DOCS, DocLink, Section, type SectionProps } from "./shared";

// Settings → Connections: the MCP address, how to connect each client, the
// apps connected by sign-in (OAuth), personal tokens, and teammates.
// The section id stays "grokbot" so existing deep links keep working.

type Token = { id: string; name: string; prefix: string; scope: string; created_at: string; last_used_at: string | null; revoked_at: string | null };
type App = { id: string; name: string; client_uri: string | null; logo_uri: string | null; redirect_uris: string[]; created_at: string; last_used_at: string | null };
type Client = "claude" | "chatgpt" | "grok" | "other";

const EASE = [0.22, 1, 0.36, 1] as const;

export function GrokBotSection(props: SectionProps) {
  const [origin, setOrigin] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(t);
  }, []);
  const url = `${origin}/api/mcp`;
  return (
    <div className="flex flex-col gap-8">
      <Section title="Your MCP server" hint="Any assistant that speaks MCP connects to this address.">
        <div className="flex items-center gap-2 rounded-[14px] bg-gray-100 py-1.5 pl-3.5 pr-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{url}</code>
          <CopyButton text={url} srLabel="Copy MCP server URL" />
        </div>
      </Section>
      <ConnectGuide url={url} fresh={fresh} />
      <ConnectedApps reloadOverview={props.reloadOverview} />
      <TokensSection reloadOverview={props.reloadOverview} fresh={fresh} setFresh={setFresh} />
      <TeammatesSection />
    </div>
  );
}

/* ---------------- connect guide ---------------- */

/** Phone and Mac keys live in their own section; this list is for bots. */
const bots = (tokens: Token[]) => tokens.filter((t) => t.scope !== "app");

function grokMessage(url: string, token: string | null) {
  return `Add a custom MCP server named "Hyperpolymath". URL: ${url}. Header: Authorization: Bearer ${token ?? "<paste your token>"}. Store the token as a secret, then call get_overview to confirm it works.`;
}

const DOC = (slug: string) => DOCS.connect.replace("README.md", `${slug}.md`);

function ConnectGuide({ url, fresh }: { url: string; fresh: string | null }) {
  const [client, setClient] = useState<Client>("claude");
  const still = useReducedMotion();
  const steps: Record<Client, ReactNode> = {
    claude: (
      <>
        <Step n={1}>
          In Claude, open <b>Customize → Connectors</b>, then <b>+ Add → Add custom connector</b>.
        </Step>
        <Step n={2}>
          Name it <b>Hyperpolymath</b> and paste the server URL. Keep the suggested sign-in settings.
          <UrlChip url={url} />
        </Step>
        <Step n={3}>
          Click <b>Connect</b> and approve on the Hyperpolymath screen. It works on web, desktop and mobile.
        </Step>
        <Hint>
          Claude Code: <code className="font-mono">claude mcp add --transport http hyperpolymath {url || "<url>"}</code>, then <code className="font-mono">/mcp</code> to sign in.{" "}
          <DocLink href={DOC("claude")}>Full guide</DocLink>
        </Hint>
      </>
    ),
    chatgpt: (
      <>
        <Step n={1}>
          In ChatGPT on the web, open <b>Settings → Apps → Advanced settings</b> and turn on <b>Developer mode</b>.
        </Step>
        <Step n={2}>
          Click <b>Create app</b>, name it <b>Hyperpolymath</b>, paste the server URL and choose <b>OAuth</b>.
          <UrlChip url={url} />
        </Step>
        <Step n={3}>Sign in and approve. In a chat, pick Hyperpolymath from the + menu.</Step>
        <Hint>
          Plans and menu names vary. <DocLink href={DOC("chatgpt")}>Full guide</DocLink>
        </Hint>
      </>
    ),
    grok: (
      <>
        <Step n={1}>
          In Grok Bot, open <b>Connect apps → Add a custom connector</b>, choose Remote HTTPS and paste the server URL.
          <UrlChip url={url} />
        </Step>
        <Step n={2}>Sign in on the card that appears and approve. Every bot on the account shares it.</Step>
        <Step n={3}>
          Prefer a token? Create one below and send this in any bot chat{fresh ? " (your new token is filled in)" : ""}:
          <div className="mt-2 rounded-[14px] bg-gray-100 p-3">
            <p className="select-all break-words font-mono text-[12.5px] leading-relaxed text-ink">{grokMessage(url, fresh)}</p>
            <div className="mt-2.5 flex justify-end">
              <CopyButton text={grokMessage(url, fresh)} label="Copy message" />
            </div>
          </div>
        </Step>
        <Hint>
          Then set up Kiwi and the reminder relay: <DocLink href={DOCS.grokbot}>Grok Bot guide</DocLink>
        </Hint>
      </>
    ),
    other: (
      <>
        <Step n={1}>Any MCP client with OAuth sign-in: give it the server URL and it finds the sign-in screen on its own.</Step>
        <Step n={2}>
          No OAuth? Create a personal token below and send it as <code className="font-mono">Authorization: Bearer hpm_…</code>.
          <UrlChip url={url} />
        </Step>
        <Hint>
          <DocLink href={DOC("other-clients")}>Setup notes for other clients</DocLink>
        </Hint>
      </>
    ),
  };
  return (
    <section aria-labelledby="settings-connect">
      <h4 id="settings-connect" tabIndex={-1} className="text-[15px] font-semibold outline-none">
        Connect an assistant
      </h4>
      <p className="mt-0.5 text-[13px] leading-snug text-ink-3">Pick yours. Sign-in clients never see a token.</p>
      <Segmented<Client>
        className="mt-3 flex-wrap"
        size="sm"
        value={client}
        onChange={setClient}
        options={[
          { value: "claude", label: "Claude" },
          { value: "chatgpt", label: "ChatGPT" },
          { value: "grok", label: "Grok Bot" },
          { value: "other", label: "Other" },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.ol
          key={client}
          role="tabpanel"
          initial={still ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={still ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="mt-3.5 flex flex-col gap-3 text-[13.5px] leading-snug text-ink-2"
        >
          {steps[client]}
        </motion.ol>
      </AnimatePresence>
    </section>
  );
}

function UrlChip({ url }: { url: string }) {
  return (
    <span className="mt-2 flex items-center gap-2 rounded-[12px] bg-gray-100 py-1 pl-3 pr-1">
      <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">{url}</code>
      <CopyButton text={url} srLabel="Copy MCP server URL" />
    </span>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <li className="list-none rounded-[12px] bg-gray-50 px-3 py-2 text-[12.5px] leading-relaxed text-ink-3 ring-1 ring-gray-150">{children}</li>;
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
      <div className="min-w-0 flex-1 [&_b]:font-medium [&_b]:text-ink">{children}</div>
    </li>
  );
}

/* ---------------- connected apps (OAuth) ---------------- */

function AppMark({ app }: { app: App }) {
  const [broken, setBroken] = useState(false);
  if (app.logo_uri && !broken) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-white shadow-ring">
        {/* eslint-disable-next-line @next/next/no-img-element -- third-party client logos, any host */}
        <img src={app.logo_uri} alt="" width={22} height={22} referrerPolicy="no-referrer" className="h-[22px] w-[22px] object-contain" onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-[15px] font-semibold text-accent">
      {app.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function ConnectedApps({ reloadOverview }: { reloadOverview: () => void }) {
  const { run, nowMs } = useDashboard();
  const [apps, setApps] = useState<App[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void run(listConnectedAppsAction()).then((a) => {
      if (live) setApps(a ?? []);
    });
    return () => {
      live = false;
    };
  }, [run]);

  const disconnect = async (app: App) => {
    setBusy(app.id);
    const ok = await run(disconnectAppAction(app.id), { success: `${app.name} disconnected` });
    setBusy(null);
    setConfirmId(null);
    if (ok) {
      setApps((prev) => prev?.filter((a) => a.id !== app.id) ?? null);
      reloadOverview();
    }
  };

  return (
    <Section title="Connected apps" hint="Assistants you approved with a sign-in. Disconnecting signs them out at once.">
      <ul className="divide-y divide-gray-150" aria-busy={apps === null}>
        {apps === null && <li className="skeleton my-2 h-12 rounded-[12px]" />}
        {apps?.length === 0 && <li className="py-2 text-[13px] text-ink-3">Nothing connected by sign-in yet.</li>}
        <AnimatePresence initial={false}>
          {apps?.map((a) => (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.25, ease: EASE } }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <AppMark app={a} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{a.name}</div>
                  <div className="text-[12.5px] text-gray-500">
                    Connected {relativeTime(a.created_at, nowMs)} · {a.last_used_at ? `active ${relativeTime(a.last_used_at, nowMs)}` : "not used yet"}
                  </div>
                </div>
                {confirmId === a.id ? (
                  <div className="flex items-center gap-1" role="group" aria-label={`Disconnect ${a.name}?`}>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)} autoFocus>
                      Keep
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void disconnect(a)} disabled={busy === a.id}>
                      {busy === a.id ? "Disconnecting…" : "Disconnect"}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(a.id)} aria-label={`Disconnect ${a.name}`}>
                    Disconnect
                  </Button>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Section>
  );
}

/* ---------------- personal tokens ---------------- */

function TokensSection({
  reloadOverview,
  fresh,
  setFresh,
}: {
  reloadOverview: () => void;
  fresh: string | null;
  setFresh: (t: string | null) => void;
}) {
  const { run, nowMs } = useDashboard();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState("Grok Bot");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"mint" | string | null>(null);

  useEffect(() => {
    let live = true;
    void run(listTokensAction()).then((t) => {
      if (live) setTokens(t ? bots(t) : []);
    });
    return () => {
      live = false;
    };
  }, [run]);

  const reload = async () => {
    const t = await run(listTokensAction());
    if (t) setTokens(bots(t));
    reloadOverview();
  };

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
    <Section
      title="Personal tokens"
      hint="For clients without sign-in (a Grok Bot header, scripts, iOS Shortcuts and the capture endpoint). Each is a bearer key; revoke one any time."
    >
      <AnimatePresence initial={false}>
        {fresh && (
          <motion.div
            key="fresh"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>

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
                <span className="mr-1 text-[12.5px] text-ink-3">Anything using it loses access.</span>
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
  );
}

/* ---------------- teammates ---------------- */

function TeammatesSection() {
  const { data, openTeammates } = useDashboard();
  const paused = data.routines.filter((r) => !r.enabled).length;
  return (
    <Section title="Teammates and routines" hint="Edit your bots, and pause or resume the routines they run.">
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
