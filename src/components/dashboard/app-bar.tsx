"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { WidgetRow } from "@/lib/dashboard-types";
import { Logotype, Monogram } from "@/components/ui/brand";
import { IconChevronLeft, IconGear, IconHome, IconSearch } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/primitives";
import { FEATURE_ORDER, KindIcon, featureLabel } from "./features";

/** The built-in features present on this dashboard, in navigation order. */
export function navWidgets(widgets: WidgetRow[]): WidgetRow[] {
  return FEATURE_ORDER.map((k) => widgets.find((w) => w.kind === k)).filter((w): w is WidgetRow => !!w);
}

const subscribeNever = () => () => {};

/** "⌘" on Apple devices, "Ctrl" elsewhere (the server guesses Apple). */
export function useModKey() {
  return useSyncExternalStore(
    subscribeNever,
    () => (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl "),
    () => "⌘",
  );
}

/**
 * The app's top bar, shared by the dashboard and every full-page view:
 * brand (or a way back), feature tabs, search and settings.
 */
export function AppBar({
  widgets,
  current,
  scrolled,
  onHome,
  onOpen,
  onSearch,
  onSettings,
  trailing,
}: {
  widgets: WidgetRow[];
  /** The widget whose full view is open, or null on the dashboard. */
  current: WidgetRow | null;
  scrolled: boolean;
  onHome: () => void;
  onOpen: (w: WidgetRow) => void;
  onSearch: () => void;
  onSettings: () => void;
  trailing?: ReactNode;
}) {
  const mod = useModKey();
  return (
    <header
      className={`sticky top-0 z-30 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-shadow duration-200 ${
        scrolled ? "shadow-[0_1px_0_rgb(20_20_20/0.06)]" : ""
      }`}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1168px] items-center gap-2 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-1 lg:w-[220px]">
          {current ? (
            <button
              type="button"
              onClick={onHome}
              aria-label="Back to home"
              className="-ml-2 flex h-9 min-w-0 shrink-0 items-center gap-1 rounded-full pl-1.5 pr-1.5 text-[14px] font-medium text-ink-2 transition hover:bg-gray-150 hover:text-ink md:pr-3"
            >
              <IconChevronLeft size={19} className="shrink-0" />
              <span className="truncate max-md:hidden">Home</span>
            </button>
          ) : (
            <button type="button" onClick={onHome} className="flex items-center gap-2 rounded-[10px] text-ink" aria-label="Hyperpolymath home">
              <Monogram size={26} className="min-[400px]:hidden" />
              <Logotype className="text-[20px] leading-none max-[399px]:hidden" />
            </button>
          )}
          {current && (
            <span className="flex min-w-0 items-center gap-2 md:hidden">
              <KindIcon widget={current} size={16} />
              <span className="truncate text-[15px] font-semibold">{featureLabel(current)}</span>
            </span>
          )}
        </div>

        <nav aria-label="Features" className="hidden min-w-0 flex-1 justify-center md:flex">
          <FeatureTabs widgets={widgets} current={current} onHome={onHome} onOpen={onOpen} />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 lg:w-[220px] lg:justify-end">
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search and jump"
            className="flex h-9 items-center gap-2 rounded-full text-[13.5px] text-ink-3 transition max-sm:w-9 max-sm:justify-center max-sm:text-gray-700 max-sm:hover:bg-gray-150 sm:bg-gray-150 sm:pl-3 sm:pr-2 sm:hover:bg-gray-200 sm:hover:text-ink-2"
          >
            <IconSearch size={17} className="shrink-0" />
            <span className="max-sm:hidden">Search</span>
            <kbd className="rounded-[6px] bg-surface px-1.5 py-px font-sans text-[11.5px] font-medium text-ink-3 shadow-ring max-sm:hidden">
              {mod}K
            </kbd>
          </button>
          {trailing}
          <IconButton label="Settings" onClick={onSettings}>
            <IconGear size={19} />
          </IconButton>
        </div>
      </div>
    </header>
  );
}

function FeatureTabs({
  widgets,
  current,
  onHome,
  onOpen,
  className = "",
}: {
  widgets: WidgetRow[];
  current: WidgetRow | null;
  onHome: () => void;
  onOpen: (w: WidgetRow) => void;
  className?: string;
}) {
  // Icons only until there's room for labels.
  const tab = (active: boolean) =>
    `flex h-8 shrink-0 items-center gap-1.5 rounded-full text-[13.5px] font-medium transition max-lg:w-9 max-lg:justify-center lg:px-3 ${
      active ? "bg-surface text-ink shadow-ring" : "text-ink-2 hover:bg-gray-150 hover:text-ink"
    }`;
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <button type="button" onClick={onHome} aria-current={!current ? "page" : undefined} title="Home" className={tab(!current)}>
        <IconHome size={15} className="text-gray-600" />
        <span className="max-lg:sr-only">Home</span>
      </button>
      {navWidgets(widgets).map((w) => {
        const active = current?.id === w.id;
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => onOpen(w)}
            aria-current={active ? "page" : undefined}
            title={featureLabel(w)}
            className={tab(active)}
          >
            <KindIcon widget={w} size={15} tinted={active} className={active ? "" : "text-gray-600"} />
            <span className="max-lg:sr-only">{featureLabel(w)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Phone version of the tabs: one scrollable row of chips. */
export function FeatureStrip({
  widgets,
  current,
  onHome,
  onOpen,
  className = "",
}: {
  widgets: WidgetRow[];
  current: WidgetRow | null;
  onHome: () => void;
  onOpen: (w: WidgetRow) => void;
  className?: string;
}) {
  const chip = (active: boolean) =>
    `flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium transition ${
      active ? "bg-ink text-white" : "bg-gray-150 text-ink-2 active:bg-gray-200"
    }`;
  return (
    <nav aria-label="Features" className={`no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:hidden ${className}`}>
      {current && (
        <button type="button" onClick={onHome} className={chip(false)}>
          <IconHome size={15} />
          Home
        </button>
      )}
      {navWidgets(widgets).map((w) => {
        const active = current?.id === w.id;
        return (
          <button key={w.id} type="button" onClick={() => onOpen(w)} aria-current={active ? "page" : undefined} className={chip(active)}>
            <KindIcon widget={w} size={15} tinted={!active} />
            {featureLabel(w)}
          </button>
        );
      })}
    </nav>
  );
}
