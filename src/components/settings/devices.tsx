"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { relativeTime } from "@/lib/format";
import { listTokensAction, mintAppTokenAction, revokeTokenAction } from "@/app/actions/settings";
import { Button, fieldClass } from "@/components/ui/primitives";
import { IconPlus } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import { QrCode } from "@/components/ui/qr-code";
import { useDashboard } from "@/components/dashboard/context";
import { CopyButton, DOCS, DocLink, Section, cardClass } from "./shared";

// Phone and Mac: pair the native apps (apple/ in the repo). Each device gets
// its own app-scoped token, which can read the app API, capture, tick tasks
// and log habits, but can't reach MCP. Pairing is a QR code the iPhone camera
// opens straight into the app, or a link to paste on the Mac.

type Token = {
  id: string;
  name: string;
  prefix: string;
  scope: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

/** The link the apps understand: hyperpolymath://connect?server=...&token=... */
export function pairingLink(server: string, token: string) {
  return `hyperpolymath://connect?server=${encodeURIComponent(server)}&token=${encodeURIComponent(token)}`;
}

export function DevicesSection() {
  const { run, nowMs } = useDashboard();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState("iPhone");
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
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

  const pair = async () => {
    setBusy("mint");
    const label = name.trim() || "iPhone";
    const t = await run(mintAppTokenAction(label));
    setBusy(null);
    if (t) {
      setFresh({ token: t.token, name: label });
      void reload();
    }
  };

  const revoke = async (id: string) => {
    setBusy(id);
    const ok = await run(revokeTokenAction(id), { success: "Device disconnected" });
    setBusy(null);
    setConfirmId(null);
    if (ok) void reload();
  };

  const devices = tokens?.filter((t) => t.scope === "app") ?? null;
  const link = fresh && origin ? pairingLink(origin, fresh.token) : null;

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Connect a device"
        hint={
          <>
            Your day on the iPhone home screen and lock screen, and in the Mac menu bar. Build the apps from the{" "}
            <DocLink href={DOCS.apple}>apple folder</DocLink>, then pair them here.
          </>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {link && fresh ? (
            <motion.div
              key="qr"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-4 rounded-[20px] bg-gray-50 p-5 shadow-ring sm:flex-row sm:items-start"
              role="status"
            >
              <div className="rounded-[18px] bg-white p-3 text-ink shadow-[0_0_0_1px_rgb(20_20_20/0.06),0_8px_24px_rgb(20_20_20/0.08)]">
                <QrCode value={link} size={188} label={`Pairing code for ${fresh.name}`} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2.5 text-[13.5px] leading-snug">
                <p className="text-[15px] font-semibold">Scan with your iPhone camera</p>
                <ol className="list-decimal space-y-1 pl-4 text-ink-2">
                  <li>Point the Camera app at the code and tap the banner.</li>
                  <li>Hyperpolymath opens and connects on its own.</li>
                  <li>On a Mac, copy the link and paste it into the menu bar app.</li>
                </ol>
                <div className="flex items-center gap-2 rounded-[12px] bg-white py-1.5 pl-3 pr-1.5 shadow-ring">
                  <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{link}</code>
                  <CopyButton text={link} label="Copy link" srLabel="Copy pairing link" />
                </div>
                <p className="text-[12.5px] text-ink-3">
                  The code holds a key for this device only. It won&apos;t be shown again, and you can disconnect the device below any time.
                </p>
                <button
                  type="button"
                  className="self-start text-[13px] font-medium text-accent-hover hover:underline"
                  onClick={() => setFresh(null)}
                >
                  Done
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void pair();
              }}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Device name"
                maxLength={60}
                className={`${fieldClass} flex-1`}
                aria-label="Device name"
              />
              <Button type="submit" variant="dark" className="shrink-0" disabled={busy === "mint"}>
                {busy === "mint" ? <KiwiLoader size={18} label="Creating pairing code" /> : <IconPlus size={15} />} Pair device
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </Section>

      <Section title="Connected devices" hint="Each device has its own key. It can read your day, capture, tick tasks and log habits, but it can't reach MCP.">
        <ul className={`${cardClass} divide-y divide-gray-150`} aria-busy={devices === null}>
          {devices === null && <li className="skeleton my-2 h-10 rounded-[12px]" />}
          {devices?.length === 0 && <li className="py-3 text-[13px] text-ink-3">No devices yet.</li>}
          {devices?.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[14px] font-medium ${t.revoked_at ? "text-ink-3 line-through" : ""}`}>{t.name}</div>
                <div className="text-[12.5px] text-gray-500">
                  paired {relativeTime(t.created_at, nowMs)} · {t.last_used_at ? `seen ${relativeTime(t.last_used_at, nowMs)}` : "not opened yet"}
                </div>
              </div>
              {t.revoked_at ? (
                <span className="rounded-full bg-gray-150 px-2 py-0.5 text-[11.5px] font-medium text-gray-600">Disconnected</span>
              ) : confirmId === t.id ? (
                <div className="flex items-center gap-1" role="group" aria-label={`Disconnect ${t.name}?`}>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)} autoFocus>
                    Keep
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void revoke(t.id)} disabled={busy === t.id}>
                    {busy === t.id ? "Disconnecting…" : "Disconnect"}
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmId(t.id)} aria-label={`Disconnect ${t.name}`}>
                  Disconnect
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
