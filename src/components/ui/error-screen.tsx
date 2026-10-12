"use client";

import { useEffect, useState, useTransition } from "react";
import { KiwiFixing } from "@/components/illustrations";
import { KiwiLoader } from "./kiwi-loader";
import { IconCheck, IconCopy } from "./icons";
import { StatePage, statePrimary, stateSecondary } from "./state-page";

/** Shared body of error.tsx and global-error.tsx. */
export function ErrorScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const digest = error.digest;

  useEffect(() => {
    console.error(error);
  }, [error]);

  const copy = async () => {
    if (!digest) return;
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; the reference is selectable */
    }
  };

  return (
    <StatePage
      art={<KiwiFixing size={168} title="Kiwi with a wrench" />}
      title="Something went wrong"
      actions={
        <>
          <button type="button" onClick={() => startTransition(() => retry())} disabled={pending} className={statePrimary}>
            {pending ? <KiwiLoader size={22} label="Trying again" /> : null}
            {pending ? "Trying again…" : "Try again"}
          </button>
          {/* A full load, in case the client router is what broke. */}
          <button type="button" onClick={() => window.location.assign("/")} className={stateSecondary}>
            Go to the dashboard
          </button>
        </>
      }
    >
      <p>Kiwi has the toolbox out. Your data is safe; this screen just failed to load.</p>
      {digest && (
        <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-gray-100 py-1 pl-3.5 pr-1 text-[12.5px] text-ink-2">
          <span className="shrink-0">Reference</span>
          <code className="min-w-0 truncate font-mono text-ink">{digest}</code>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Reference copied" : "Copy error reference"}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-white px-2.5 font-medium text-ink shadow-ring transition hover:bg-gray-50"
          >
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {copied ? "Reference copied" : ""}
      </p>
    </StatePage>
  );
}
