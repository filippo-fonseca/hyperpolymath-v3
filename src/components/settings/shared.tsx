"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/primitives";
import { IconCheck, IconCopy } from "@/components/ui/icons";
import { KiwiLoader } from "@/components/ui/kiwi-loader";
import type { SettingsOverview } from "@/app/actions/status";

/** What every settings section can use: the shared overview and navigation. */
export type SectionProps = {
  overview: SettingsOverview | null;
  /** True when the overview couldn't load (offline, server error). */
  overviewFailed: boolean;
  reloadOverview: () => void;
  go: (section: SectionId, focusId?: string) => void;
};

export type SectionId = "setup" | "account" | "preferences" | "grokbot" | "calendar" | "reminders" | "data" | "about";

export const REPO_URL = "https://github.com/filippo-fonseca/hyperpolymath-v3";
export const DOCS = {
  grokbot: `${REPO_URL}/blob/HEAD/docs/GROKBOT-SETUP.md`,
  kiwiSetup: `${REPO_URL}/blob/HEAD/docs/GROKBOT-SETUP.md#3-make-your-coordinator-kiwi`,
  relay: `${REPO_URL}/blob/HEAD/docs/GROKBOT-SETUP.md#4-reminder-relay-routine-how-nudges-reach-you`,
  kiwi: `${REPO_URL}/blob/HEAD/docs/WORKING-WITH-KIWI.md`,
  deploy: `${REPO_URL}/blob/HEAD/docs/DEPLOY.md`,
  google: `${REPO_URL}/blob/HEAD/docs/DEPLOY.md#3-google-calendar`,
};

export function Section({ title, hint, children, id }: { title: string; hint?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined}>
      <h4 id={id ? `${id}-title` : undefined} className="text-[15px] font-semibold">
        {title}
      </h4>
      {hint && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function CopyButton({ text, label = "Copy", srLabel }: { text: string; label?: string; srLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="soft"
        aria-label={srLabel}
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
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}

/** A quiet external link that opens in a new tab. */
export function DocLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={`font-medium text-accent underline-offset-2 transition hover:text-accent-hover hover:underline ${className}`}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** Small green / amber / gray status dot. */
export function Dot({ tone }: { tone: "ok" | "warn" | "off" }) {
  const c = tone === "ok" ? "bg-success" : tone === "warn" ? "bg-[#f5a524]" : "bg-gray-300";
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${c}`} />;
}

/** Overview still loading or failed: a calm placeholder with a retry. */
export function OverviewPending({ failed, retry, label = "Loading status" }: { failed: boolean; retry: () => void; label?: string }) {
  if (failed) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-[14px] bg-gray-100 px-3.5 py-3 text-[13.5px] text-ink-2" role="alert">
        Couldn&apos;t load this right now.
        <Button size="sm" variant="soft" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div className="flex h-24 items-center justify-center">
      <KiwiLoader size={36} label={label} />
    </div>
  );
}

/** A label / value row inside a soft card. */
export function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13.5px] text-ink-2">{label}</dt>
      <dd className="min-w-0 text-right text-[13.5px] font-medium">{children}</dd>
    </div>
  );
}

export const cardClass = "rounded-[16px] bg-gray-50 px-3.5 shadow-ring";
