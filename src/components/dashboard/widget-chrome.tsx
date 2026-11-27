"use client";

import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";
import type { WidgetRow } from "@/lib/dashboard-types";
import { SIZE_LABELS, WIDGET_SIZES, type WidgetSize } from "@/lib/widgets";
import { IconChevronDown, IconDots, IconExpand, IconGear, IconWidgets } from "@/components/ui/icons";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { stop } from "@/components/ui/primitives";
import { KindIcon, featureLabel } from "./features";
import { SizeGlyph } from "./size-picker";

// The frame every widget body sits in: which widget it is, how big, and the
// card-level actions its header offers (open, resize, settings, edit).

type Frame = {
  widget: WidgetRow;
  size: WidgetSize;
  open: () => void;
  resize: (s: WidgetSize) => void;
  settings: () => void;
  editLayout: () => void;
  /** Widgets that size to their content report its height in px (null: the size's full box). */
  fit?: (px: number | null) => void;
  /** Folded to a single strip (stale, or everything in it done or past), and why. */
  collapsed?: CollapseReason | null;
  /** Fold or unfold the card; only offered where the widget can collapse. */
  toggleCollapse?: () => void;
};

export type CollapseReason = "stale" | "done" | "past" | "manual";

const FrameCtx = createContext<Frame | null>(null);

export function WidgetFrame({ value, children }: { value: Frame; children: ReactNode }) {
  return <FrameCtx value={value}>{children}</FrameCtx>;
}

export function useWidgetFrame() {
  return useContext(FrameCtx);
}

/**
 * For list widgets that fit rows to their card: report the height the card
 * needs to show `listPx` of rows (null: keep the size's full box). The rest
 * of the widget (header, identity row) is measured as everything in `root`
 * outside `list`, so it stays right whatever the widget puts there.
 */
export function useFitList(root: HTMLElement | null, list: HTMLElement | null, listPx: number | null) {
  const fit = useWidgetFrame()?.fit;
  useLayoutEffect(() => {
    if (!fit) return;
    if (listPx == null || !root || !list) return fit(null);
    const surface = root.parentElement;
    const report = () => {
      const cs = surface ? getComputedStyle(surface) : null;
      const padY = cs ? parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) : 0;
      fit(Math.ceil(root.offsetHeight - list.offsetHeight + listPx + padY));
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(root);
    return () => ro.disconnect();
  }, [fit, root, list, listPx]);
}

/** Small round icon button for widget headers; never opens the card. */
export function HeaderAction({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-150 hover:text-ink active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Widget header: kind glyph, title, a count or status on the right, and on
 * hover (always on touch screens) quick actions, open in full, and a menu.
 */
export function WidgetHeader({
  meta,
  actions,
  icon,
  title,
  className = "",
}: {
  meta?: ReactNode;
  /** Extra quick actions, shown before open and the menu. */
  actions?: ReactNode;
  icon?: ReactNode;
  title?: ReactNode;
  className?: string;
}) {
  const frame = useWidgetFrame();
  const w = frame?.widget;
  const small = frame?.size === "s";
  const items: MenuItem[] = frame
    ? [
        { label: `Open ${featureLabel(frame.widget)}`, icon: <IconExpand size={15} />, onSelect: frame.open, hint: "Full page" },
        { divider: true },
        { heading: "Size" },
        ...WIDGET_SIZES.map((s) => ({
          label: SIZE_LABELS[s],
          icon: <SizeGlyph size={s} active={s === frame.size} />,
          checked: s === frame.size,
          onSelect: () => frame.resize(s),
        })),
        { divider: true },
        ...(frame.toggleCollapse
          ? [{ label: frame.collapsed ? "Expand card" : "Collapse card", icon: <IconChevronDown size={15} />, onSelect: frame.toggleCollapse }]
          : []),
        { label: "Widget settings", icon: <IconGear size={15} />, onSelect: frame.settings },
        { label: "Edit widgets", icon: <IconWidgets size={15} />, onSelect: frame.editLayout },
      ]
    : [];

  return (
    <div className={`flex h-7 min-w-0 shrink-0 items-center gap-2 ${className}`}>
      {icon ?? (w && <KindIcon widget={w} size={15} />)}
      <span className="min-w-0 truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">{title ?? w?.title}</span>
      <span className="ml-auto flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-[12px] font-medium tabular-nums text-gray-500">
        {meta}
      </span>
      {frame && (
        <span
          className="-mr-1.5 flex max-w-0 shrink-0 items-center overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 group-focus-within/card:max-w-[132px] group-focus-within/card:opacity-100 group-hover/card:max-w-[132px] group-hover/card:opacity-100 [@media(hover:none)]:max-w-[132px] [@media(hover:none)]:opacity-100"
        >
          {!small && actions}
          {!small && (
            <HeaderAction label={`Open ${featureLabel(frame.widget)}`} onClick={frame.open} className="[@media(hover:none)]:hidden">
              <IconExpand size={15} />
            </HeaderAction>
          )}
          <Menu
            label="Widget options"
            items={items}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-150 hover:text-ink"
          >
            <IconDots size={17} />
          </Menu>
        </span>
      )}
    </div>
  );
}
