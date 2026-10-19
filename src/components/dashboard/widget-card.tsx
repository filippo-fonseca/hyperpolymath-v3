"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion } from "motion/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconMinus } from "@/components/ui/icons";
import type { WidgetSize } from "@/lib/widgets";

const LONG_PRESS_MS = 500;

export function cardPadding(size: WidgetSize) {
  return size === "s" ? "p-4" : "p-[18px]";
}

/** The visual card shared by the grid and the drag overlay. */
export function CardSurface({
  size,
  children,
  lifted = false,
  className = "",
  style,
}: {
  size: WidgetSize;
  children: ReactNode;
  lifted?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`group/card relative h-full w-full overflow-hidden bg-surface transition-shadow duration-200 ${cardPadding(size)} ${
        lifted ? "shadow-lift" : "shadow-widget [@media(hover:hover)]:hover:shadow-widget-hover"
      } ${className}`}
      style={{ borderRadius: 22, ...style }}
    >
      {children}
    </div>
  );
}

export function WidgetCard({
  id,
  size,
  index,
  editing,
  expanded,
  removable,
  rows,
  span,
  onOpen,
  onEdit,
  onLongPress,
  children,
}: {
  id: string;
  size: WidgetSize;
  index: number;
  editing: boolean;
  expanded: boolean;
  removable: boolean;
  /** Rows the content needs, when that's fewer than the size's own (custom widgets). */
  rows?: number | null;
  /** Rows the card spans right now, for widgets measuring themselves. */
  span: number;
  onOpen: () => void;
  onEdit: () => void;
  onLongPress: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);

  const clearPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, button, a, select, [data-no-press]")) return;
    clearPress();
    const state = { x: e.clientX, y: e.clientY, fired: false, timer: 0 };
    state.timer = window.setTimeout(() => {
      state.fired = true;
      navigator.vibrate?.(8);
      onLongPress();
    }, LONG_PRESS_MS);
    press.current = state;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) clearPress();
  };

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition ?? undefined,
    zIndex: isDragging ? 0 : undefined,
    ...(rows ? { gridRowEnd: `span ${rows}` } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-rows={span}
      className={`relative min-w-0 size-${size} ${editing ? "touch-manipulation" : ""}`}
      {...(editing ? attributes : {})}
      {...(editing ? listeners : {})}
    >
      {isDragging ? (
        <div className="h-full w-full rounded-[22px] border-[1.5px] border-dashed border-gray-300 bg-gray-50" />
      ) : (
        <div
          className={`h-full w-full ${editing ? "wiggle" : ""}`}
          style={editing ? { animationDelay: `${-((index * 97) % 280)}ms` } : undefined}
        >
          {expanded ? (
            <div className="h-full w-full" />
          ) : (
            <motion.div
              layoutId={`widget-${id}`}
              transition={{ type: "spring", duration: 0.38, bounce: 0 }}
              className="h-full w-full"
              style={{ borderRadius: 22 }}
              role={editing ? undefined : "button"}
              tabIndex={editing ? undefined : 0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={clearPress}
              onPointerCancel={clearPress}
              onPointerLeave={clearPress}
              onContextMenu={(e) => {
                if (press.current?.fired) e.preventDefault();
              }}
              onClick={(e) => {
                if (press.current?.fired) {
                  press.current = null;
                  e.preventDefault();
                  return;
                }
                if (editing) onEdit();
                else onOpen();
              }}
              onKeyDown={(e) => {
                if (!editing && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                  e.preventDefault();
                  onOpen();
                }
              }}
            >
              <CardSurface size={size} className={editing ? "pointer-events-none select-none" : ""}>
                {children}
              </CardSurface>
            </motion.div>
          )}
          {editing && removable && (
            <button
              type="button"
              aria-label="Remove widget"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="absolute -left-2 -top-2 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gray-700 text-white shadow-ring"
            >
              <IconMinus size={13} strokeWidth={2.6} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
