"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { CalendarData, DashboardData, WidgetRow } from "@/lib/dashboard-types";
import { isCustomKind, type WidgetSize } from "@/lib/widgets";
import { saveLayoutAction } from "@/app/actions/widgets";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { Logotype, Monogram } from "@/components/ui/brand";
import { IconGear } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/primitives";
import { longDate, weekdayName } from "@/lib/format";
import { DashboardProvider, useDashboard, type TeammatesFocus } from "./context";
import { CardSurface, WidgetCard } from "./widget-card";
import { ExpandedView } from "./expanded";
import { WidgetSheet, AddWidgetSheet } from "./widget-sheet";
import { SettingsSheet } from "./settings-sheet";
import { RealtimeRefresh } from "./realtime";
import { AddProjectsOffer } from "./add-projects-offer";
import { asWidgetSize, groupPages, moveToPage, normalizeLayout, reorder } from "./layout-utils";
import { WidgetBody, WidgetExpanded } from "@/components/widgets/registry";
import { TeammatesView } from "@/components/teammates/teammates-view";

type LocalWidget = WidgetRow & { size: WidgetSize };

function toLocal(ws: WidgetRow[]): LocalWidget[] {
  return normalizeLayout(ws.map((w) => ({ ...w, size: asWidgetSize(w.size) })));
}

export function Dashboard({ data, calendar }: { data: DashboardData; calendar: Promise<CalendarData> }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [teammates, setTeammates] = useState<{ focus: TeammatesFocus; key: number } | null>(null);
  const open = useCallback((id: string) => {
    setTeammates(null);
    setExpandedId(id);
  }, []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openTeammates = useCallback((focus: TeammatesFocus = {}) => {
    setSettingsOpen(false);
    setSheetId(null);
    setTeammates({ focus, key: Date.now() });
  }, []);
  const openWidgetSettings = useCallback((id: string) => setSheetId(id), []);

  return (
    <ToastProvider>
      <DashboardProvider
        data={data}
        calendar={calendar}
        open={open}
        openSettings={openSettings}
        openTeammates={openTeammates}
        openWidgetSettings={openWidgetSettings}
      >
        <Home
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          sheetId={sheetId}
          setSheetId={setSheetId}
          overlayOpen={!!teammates}
        />
        <AnimatePresence>
          {teammates && <TeammatesView key={teammates.key} focus={teammates.focus} onClose={() => setTeammates(null)} />}
        </AnimatePresence>
        <GoogleReturnToast />
        {data.realtime && <RealtimeRefresh userId={data.userId} url={data.realtime.url} anonKey={data.realtime.key} />}
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </DashboardProvider>
    </ToastProvider>
  );
}

const GOOGLE_MESSAGES: Record<string, string> = {
  connected: "Google Calendar connected",
  access_denied: "Google sign-in was cancelled",
  state_mismatch: "That Google sign-in expired. Try again.",
};

/** Toast for the ?google= status the OAuth callback redirects back with. */
function GoogleReturnToast() {
  const toast = useToast();
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("google");
    if (!status) return;
    url.searchParams.delete("google");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    const text = GOOGLE_MESSAGES[status] ?? "Couldn't connect Google Calendar. Try again.";
    if (status === "connected") toast.show(text);
    else toast.error(text);
  }, [toast]);
  return null;
}

function greeting(nowMs: number, tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(nowMs));
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Home({
  expandedId,
  setExpandedId,
  sheetId,
  setSheetId,
  overlayOpen,
}: {
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  sheetId: string | null;
  setSheetId: (id: string | null) => void;
  overlayOpen: boolean;
}) {
  const { data, nowMs, run, openSettings } = useDashboard();
  const [widgets, setWidgets] = useState<LocalWidget[]>(() => toLocal(data.widgets));
  const [serverWidgets, setServerWidgets] = useState(data.widgets);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  // Adopt fresh server data (realtime refreshes) unless mid-drag.
  if (data.widgets !== serverWidgets && !dragId) {
    setServerWidgets(data.widgets);
    setWidgets(toLocal(data.widgets));
  }

  const pages = useMemo(() => groupPages(widgets), [widgets]);
  const pageCount = Math.max(1, pages.length);
  const expanded = widgets.find((w) => w.id === expandedId) ?? null;
  const sheetWidget = widgets.find((w) => w.id === sheetId) ?? null;
  const dragWidget = widgets.find((w) => w.id === dragId) ?? null;

  const persist = useCallback(
    (next: LocalWidget[]) => {
      setWidgets(next);
      void run(saveLayoutAction(next.map((w) => ({ id: w.id, page: w.page, position: w.position, size: w.size }))));
    },
    [run],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (!e.over || e.active.id === e.over.id) return;
    persist(normalizeLayout(reorder(widgets, String(e.active.id), String(e.over.id))));
  };

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const p = Math.round(el.scrollLeft / el.clientWidth);
    if (p !== page) setPage(p);
  };
  const goTo = (p: number) => {
    const el = scroller.current;
    el?.scrollTo({ left: p * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (!editing) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sheetId && !addOpen && !overlayOpen) setEditing(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [editing, sheetId, addOpen, overlayOpen]);

  return (
    <div className="mx-auto w-full max-w-[1168px] pb-32">
      <header className="flex items-start justify-between px-4 pt-[max(18px,env(safe-area-inset-top))] sm:px-6 sm:pt-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-ink">
            <Monogram size={24} className="min-[360px]:hidden" />
            <Logotype className="text-[19px] leading-none max-[359px]:hidden" />
          </div>
          <div className="mt-7 text-[13px] font-semibold">
            <span className="text-accent">{weekdayName(data.today)}</span>
            <span className="text-gray-500">, {longDate(data.today)}</span>
          </div>
          <h1 className="mt-0.5 text-[30px] font-semibold leading-tight tracking-[-0.025em]">{greeting(nowMs, data.tz)}</h1>
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-8 rounded-full px-3 text-[13.5px] font-medium text-ink-2 transition hover:bg-gray-150 hover:text-ink"
            >
              Edit
            </button>
          )}
          <IconButton label="Settings" onClick={openSettings}>
            <IconGear size={19} />
          </IconButton>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragId(null)}
      >
        <div
          ref={scroller}
          onScroll={onScroll}
          className="no-scrollbar mt-6 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {(pages.length ? pages : [[]]).map((items, p) => (
            <section
              key={p}
              aria-label={`Page ${p + 1}`}
              className="widget-page w-full shrink-0 snap-center snap-always px-4 pb-4 pt-3 sm:px-6"
            >
              <SortableContext items={items.map((w) => w.id)} strategy={rectSortingStrategy}>
                <div className="widget-grid">
                  {items.map((w, i) => (
                    <WidgetCard
                      key={w.id}
                      id={w.id}
                      size={w.size}
                      index={i}
                      editing={editing}
                      expanded={expandedId === w.id}
                      removable={isCustomKind(w.kind)}
                      onOpen={() => setExpandedId(w.id)}
                      onEdit={() => setSheetId(w.id)}
                      onLongPress={() => setEditing(true)}
                    >
                      <WidgetBody widget={w} size={w.size} />
                    </WidgetCard>
                  ))}
                </div>
              </SortableContext>
            </section>
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
          {dragWidget && (
            <div className="h-full w-full" style={{ transform: "scale(1.04)" }}>
              <CardSurface size={dragWidget.size} lifted className="pointer-events-none">
                <WidgetBody widget={dragWidget} size={dragWidget.size} />
              </CardSurface>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {pageCount > 1 && (
        <div className="mt-1 flex items-center justify-center gap-1.5" role="tablist" aria-label="Pages">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={`Page ${i + 1}`}
              onClick={() => goTo(i)}
              className="flex h-5 items-center px-0.5"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === page ? "w-4 bg-gray-700" : "w-1.5 bg-gray-300"
                }`}
              />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", duration: 0.34, bounce: 0 }}
            className="fixed inset-x-0 bottom-[max(20px,env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
          >
            <div className="flex items-center gap-1.5 rounded-full bg-white/90 p-1.5 shadow-pop backdrop-blur-xl">
              <AddProjectsOffer />
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="h-10 rounded-full px-4 text-[14px] font-medium text-ink transition hover:bg-gray-150"
              >
                Add widget
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-white transition hover:bg-accent-hover"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expanded && (
          <ExpandedView
            key={expanded.id}
            id={expanded.id}
            onClose={() => setExpandedId(null)}
            escapeActive={!sheetId && !overlayOpen}
          >
            <WidgetExpanded widget={expanded} />
          </ExpandedView>
        )}
      </AnimatePresence>

      <WidgetSheet
        widget={sheetWidget}
        pageCount={pageCount}
        onClose={() => setSheetId(null)}
        onResize={(size) => sheetWidget && persist(widgets.map((w) => (w.id === sheetWidget.id ? { ...w, size } : w)))}
        onMove={(p) => {
          if (!sheetWidget) return;
          persist(moveToPage(widgets, sheetWidget.id, p));
          goTo(Math.min(p, pageCount));
        }}
        onRemoved={(id) => {
          setSheetId(null);
          setWidgets((ws) => normalizeLayout(ws.filter((w) => w.id !== id)));
        }}
      />
      <AddWidgetSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
