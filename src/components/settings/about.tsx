"use client";

import type { ReactNode } from "react";
import { DOCS, DocLink, REPO_URL, Section, cardClass, type SectionProps } from "./shared";

/** Shortcuts the app actually implements (see primitives, dashboard, calendar and editors). */
const SHORTCUTS: { keys: string[]; what: string }[] = [
  { keys: ["Esc"], what: "Close the top sheet, popover or view; leave edit mode" },
  { keys: ["Enter"], what: "Open the focused widget; save an inline title" },
  { keys: ["Space"], what: "Open the focused widget; in edit mode, pick up or drop it" },
  { keys: ["←", "→"], what: "Calendar: previous or next day or week. Edit mode: move a picked-up widget" },
  { keys: ["T"], what: "Calendar: jump to today" },
  { keys: ["Tab"], what: "Move between controls; focus stays inside open sheets" },
];

export function AboutSection({ overview }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <Section title="Hyperpolymath" hint="A calm, one-screen dashboard run by your Grok Bot teammates.">
        <dl className={`${cardClass} divide-y divide-gray-150`}>
          <Row label="Version">
            <span className="font-mono text-[13px]">{overview ? overview.version : "…"}</span>
          </Row>
          <Row label="Source">
            <DocLink href={REPO_URL}>GitHub</DocLink>
          </Row>
        </dl>
      </Section>

      <Section title="Guides">
        <ul className="flex flex-col gap-2 text-[14px]">
          <li>
            <DocLink href={DOCS.kiwi}>Working with Kiwi</DocLink>
            <span className="text-ink-3"> · day-to-day use</span>
          </li>
          <li>
            <DocLink href={DOCS.grokbot}>Connecting Grok Bot</DocLink>
            <span className="text-ink-3"> · tokens, Kiwi and the reminder relay</span>
          </li>
          <li>
            <DocLink href={DOCS.deploy}>Deploying</DocLink>
            <span className="text-ink-3"> · environment, Google and the scheduled check</span>
          </li>
        </ul>
      </Section>

      <Section title="Keyboard shortcuts">
        <dl className={`${cardClass} divide-y divide-gray-150`}>
          {SHORTCUTS.map((s) => (
            <div key={s.what} className="flex items-start gap-4 py-2.5">
              <dt className="flex w-[76px] shrink-0 flex-wrap gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-[6px] bg-white px-1.5 font-sans text-[12px] font-medium text-ink shadow-ring"
                  >
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="min-w-0 text-[13.5px] leading-snug text-ink-2">{s.what}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-[13.5px] text-ink-2">{label}</dt>
      <dd className="text-[13.5px] font-medium">{children}</dd>
    </div>
  );
}
