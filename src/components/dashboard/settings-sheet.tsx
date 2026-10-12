"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { settingsOverviewAction, type SettingsOverview } from "@/app/actions/status";
import { Sheet, useMediaQuery } from "@/components/ui/primitives";
import { IconCalendar, IconChevronLeft, IconBell, IconChevronRight, IconGlobe, IconKey, IconMail, IconSparkle } from "@/components/ui/icons";
import type { SectionId, SectionProps } from "@/components/settings/shared";
import { SetupSection } from "@/components/settings/setup";
import { AccountSection } from "@/components/settings/account";
import { PreferencesSection } from "@/components/settings/preferences";
import { GrokBotSection } from "@/components/settings/grokbot";
import { CalendarSection } from "@/components/settings/calendar";
import { RemindersSection } from "@/components/settings/reminders";
import { useDashboard } from "./context";

// Settings: a left nav with one section at a time on desktop, and an
// iOS-style list that drills into a section on phones.

type SectionDef = {
  id: SectionId;
  label: string;
  icon: ComponentType<{ size?: number }>;
  Body: ComponentType<SectionProps>;
};

const SECTIONS: SectionDef[] = [
  { id: "setup", label: "Setup", icon: IconSparkle, Body: SetupSection },
  { id: "account", label: "Account", icon: IconMail, Body: AccountSection },
  { id: "preferences", label: "Preferences", icon: IconGlobe, Body: PreferencesSection },
  { id: "grokbot", label: "Grok Bot", icon: IconKey, Body: GrokBotSection },
  { id: "calendar", label: "Calendar", icon: IconCalendar, Body: CalendarSection },
  { id: "reminders", label: "Reminders", icon: IconBell, Body: RemindersSection },
];

const HEADING_ID = "settings-section-heading";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const desktop = useMediaQuery("(min-width: 640px)");
  const [section, setSection] = useState<SectionId | null>(null);
  const close = () => {
    onClose();
    setSection(null);
  };
  const def = SECTIONS.find((s) => s.id === section);

  const title: ReactNode =
    !desktop && def ? (
      <span className="-ml-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setSection(null)}
          aria-label="Back to all settings"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-150 active:scale-95"
        >
          <IconChevronLeft size={20} />
        </button>
        {def.label}
      </span>
    ) : (
      "Settings"
    );

  return (
    <Sheet open={open} onClose={close} title={title} width={800}>
      {open && <SettingsBody desktop={desktop} section={section} setSection={setSection} />}
    </Sheet>
  );
}

function SettingsBody({
  desktop,
  section,
  setSection,
}: {
  desktop: boolean;
  section: SectionId | null;
  setSection: (s: SectionId | null) => void;
}) {
  const { run } = useDashboard();
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [overviewFailed, setOverviewFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    void run(settingsOverviewAction(), { quiet: true }).then((o) => {
      if (!live) return;
      if (o) setOverview(o);
      setOverviewFailed(!o);
    });
    return () => {
      live = false;
    };
  }, [run, version]);

  const reloadOverview = useCallback(() => {
    setOverviewFailed(false);
    setVersion((v) => v + 1);
  }, []);

  const go = useCallback(
    (id: SectionId, focusId?: string) => {
      pendingFocus.current = focusId ?? HEADING_ID;
      setSection(id);
    },
    [setSection],
  );

  // Move focus to the section (or a specific control in it) after a jump.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const t = window.setTimeout(() => {
      const el = document.getElementById(target);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: target === HEADING_ID ? "nearest" : "center", behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [section]);

  const props: SectionProps = { overview, overviewFailed, reloadOverview, go };
  const active = SECTIONS.find((s) => s.id === section) ?? (desktop ? SECTIONS[0] : null);

  if (!desktop) {
    if (!active) {
      return (
        <div className="flex flex-col gap-6 pb-3">
          <SetupSection {...props} />
          <PhoneList go={go} />
        </div>
      );
    }
    return (
      <div className="pb-3">
        <h3 id={HEADING_ID} tabIndex={-1} className="sr-only">
          {active.label}
        </h3>
        <active.Body {...props} />
      </div>
    );
  }

  return (
    <div className="grid min-h-[min(560px,68dvh)] grid-cols-[176px_minmax(0,1fr)] gap-7 pb-3">
      <nav aria-label="Settings sections" className="sticky top-[68px] self-start">
        <ul className="flex flex-col gap-0.5">
          {SECTIONS.map((s) => {
            const on = s.id === active?.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => go(s.id)}
                  className={`flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[14px] transition ${
                    on ? "bg-gray-150 font-medium text-ink" : "text-ink-2 hover:bg-gray-100 hover:text-ink"
                  }`}
                >
                  <s.icon size={16} />
                  {s.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">
        {active && (
          <>
            <h3 id={HEADING_ID} tabIndex={-1} className="mb-5 text-[20px] font-semibold tracking-[-0.015em] outline-none">
              {active.label}
            </h3>
            <active.Body key={active.id} {...props} />
          </>
        )}
      </div>
    </div>
  );
}

function PhoneList({ go }: { go: (id: SectionId) => void }) {
  return (
    <nav aria-label="Settings sections">
      <ul className="overflow-hidden rounded-[16px] bg-gray-50 shadow-ring">
        {SECTIONS.filter((s) => s.id !== "setup").map((s, i) => (
          <li key={s.id} className={i ? "border-t border-gray-150" : ""}>
            <button type="button" onClick={() => go(s.id)} className="flex min-h-12 w-full items-center gap-3 px-3.5 text-left transition active:bg-gray-150">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-white text-ink-2 shadow-ring">
                <s.icon size={15} />
              </span>
              <span className="min-w-0 flex-1 text-[15px]">{s.label}</span>
              <IconChevronRight size={16} className="shrink-0 text-gray-400" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
