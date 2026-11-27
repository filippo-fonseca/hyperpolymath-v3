"use client";

import type { ReactNode } from "react";
import type { CustomKind, WidgetSize } from "@/lib/widgets";
import { CardSurface } from "@/components/dashboard/widget-card";
import { WidgetHeader } from "@/components/dashboard/widget-chrome";
import { WidgetIcon } from "@/components/ui/widget-icon";
import { WidgetContent, fillsCard } from "@/components/widgets/custom/content";

// A widget card at true desktop scale, outside the grid: what the builder
// previews and what the gallery thumbnails shrink.

const CELL = 112;
const GAP = 24;

/** Card size in pixels on a desktop dashboard (8 columns of square cells). */
export function cardPixels(size: WidgetSize) {
  const span = (n: number) => n * CELL + (n - 1) * GAP;
  switch (size) {
    case "s":
      return { width: span(2), height: span(2) };
    case "m":
      return { width: span(4), height: span(2) };
    case "l":
      return { width: span(4), height: span(4) };
    case "w":
      return { width: span(8), height: span(3) };
  }
}

export function PreviewCard({
  kind,
  payload,
  size,
  title,
  icon,
  meta,
  scale = 1,
  empty,
}: {
  kind: CustomKind;
  payload: unknown;
  size: WidgetSize;
  title: string;
  icon?: string | null;
  meta?: ReactNode;
  scale?: number;
  /** Shown instead of content (a widget waiting for its bot). */
  empty?: ReactNode;
}) {
  const px = cardPixels(size);
  const fill = fillsCard(kind, size, payload);
  return (
    <div style={{ width: px.width * scale, height: px.height * scale }} className="shrink-0">
      <div style={{ width: px.width, height: px.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <CardSurface size={size}>
          <div className="flex h-full min-w-0 flex-col">
            <WidgetHeader icon={icon ? <WidgetIcon icon={icon} size={15} /> : undefined} title={title || "Untitled"} meta={meta} />
            <div className="relative mt-1.5 min-h-0 min-w-0 flex-1 overflow-hidden">
              {empty ?? (
                <div className={fill ? "h-full" : ""}>
                  <WidgetContent kind={kind} payload={payload} compact size={size} />
                </div>
              )}
              {!fill && !empty && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-white" />}
            </div>
          </div>
        </CardSurface>
      </div>
    </div>
  );
}
