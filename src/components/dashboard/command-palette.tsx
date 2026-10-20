"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { WidgetRow } from "@/lib/dashboard-types";
import { dueLabel } from "@/lib/format";
import { createTaskAction } from "@/app/actions/tasks";
import { createCaptureAction } from "@/app/actions/captures";
import { useEscape, useFocusTrap, useScrollLock } from "@/components/ui/primitives";
import { IconGear, IconHome, IconPencil, IconPlus, IconSearch, IconWidgets } from "@/components/ui/icons";
import { BotAvatar } from "@/components/ui/bot-avatar";
import { useDashboard } from "./context";
import { KindIcon, featureLabel } from "./features";
import { navWidgets } from "./app-bar";

type Item = { key: string; group: string; label: ReactNode; text: string; icon: ReactNode; meta?: string; run: () => void };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");

/**
 * Search and jump (Cmd/Ctrl+K): go to any feature or bot widget, find a task
 * or project, add a task or a capture from whatever you typed.
 */
export function CommandPalette({
  open,
  onClose,
  widgets,
  onHome,
  onOpen,
  onEditLayout,
}: {
  open: boolean;
  onClose: () => void;
  widgets: WidgetRow[];
  onHome: () => void;
  onOpen: (w: WidgetRow) => void;
  onEditLayout: () => void;
}) {
  return (
    <AnimatePresence>
      {open && <Palette key="palette" onClose={onClose} widgets={widgets} onHome={onHome} onOpen={onOpen} onEditLayout={onEditLayout} />}
    </AnimatePresence>
  );
}

function Palette({
  onClose,
  widgets,
  onHome,
  onOpen,
  onEditLayout,
}: {
  onClose: () => void;
  widgets: WidgetRow[];
  onHome: () => void;
  onOpen: (w: WidgetRow) => void;
  onEditLayout: () => void;
}) {
  const { data, run, openSettings, openTeammates } = useDashboard();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  useEscape(onClose);
  useScrollLock(true);
  useFocusTrap(panel, true);

  const q = norm(query.trim());
  const items = useMemo(() => {
    const out: Item[] = [];
    const match = (s: string) => !q || norm(s).includes(q);
    const tasksW = widgets.find((w) => w.kind === "tasks");
    const projectsW = widgets.find((w) => w.kind === "projects");
    const go = (fn: () => void) => () => {
      onClose();
      fn();
    };

    if (q) {
      out.push({
        key: "new-task",
        group: "Create",
        label: (
          <>
            Add task <span className="font-semibold">{query.trim()}</span>
          </>
        ),
        text: query,
        icon: <IconPlus size={16} />,
        meta: "Today",
        run: go(() => void run(createTaskAction({ title: query.trim(), due_date: data.today }), { success: "Task added for today" })),
      });
      out.push({
        key: "new-capture",
        group: "Create",
        label: (
          <>
            Capture <span className="font-semibold">{query.trim()}</span>
          </>
        ),
        text: query,
        icon: <IconPencil size={16} />,
        run: go(() => void run(createCaptureAction(query.trim()), { success: "Captured" })),
      });
    }

    const fixed = navWidgets(widgets);
    const custom = widgets.filter((w) => !fixed.includes(w));
    if (match("home dashboard")) out.push({ key: "home", group: "Go to", label: "Home", text: "home", icon: <IconHome size={16} />, run: go(onHome) });
    for (const w of [...fixed, ...custom]) {
      const label = featureLabel(w);
      if (!match(`${label} ${w.title}`)) continue;
      out.push({ key: `w:${w.id}`, group: "Go to", label, text: label, icon: <KindIcon widget={w} size={16} />, run: go(() => onOpen(w)) });
    }

    if (q && tasksW) {
      const tasks = data.openTasks.filter((t) => match(t.title)).slice(0, 6);
      for (const t of tasks) {
        out.push({
          key: `t:${t.id}`,
          group: "Tasks",
          label: t.title,
          text: t.title,
          icon: <span className="block h-[15px] w-[15px] rounded-[5px] shadow-[inset_0_0_0_1.5px_var(--gray-400)]" />,
          meta: dueLabel(t.due_date, data.today) ?? undefined,
          run: go(() => onOpen(tasksW)),
        });
      }
    }
    if (q && projectsW) {
      const projects = [...data.areas.areas.flatMap((a) => a.projects), ...data.areas.unsorted].filter((p) => !p.archived_at && match(p.name));
      for (const p of projects.slice(0, 4)) {
        out.push({
          key: `p:${p.id}`,
          group: "Projects",
          label: p.name,
          text: p.name,
          icon: p.emoji ? <span className="text-[14px] leading-none">{p.emoji}</span> : <KindIcon widget={projectsW} size={16} />,
          meta: p.open_tasks ? `${p.open_tasks} open` : undefined,
          run: go(() => onOpen(projectsW)),
        });
      }
    }
    if (q) {
      for (const b of data.bots.filter((b) => match(b.name)).slice(0, 3)) {
        out.push({
          key: `b:${b.id}`,
          group: "Teammates",
          label: b.name,
          text: b.name,
          icon: <BotAvatar bot={b} size={18} />,
          run: go(() => openTeammates({ botId: b.id })),
        });
      }
    }

    const more: Item[] = [
      { key: "settings", group: "More", label: "Settings", text: "settings preferences account", icon: <IconGear size={16} />, run: go(openSettings) },
      { key: "team", group: "More", label: "Teammates", text: "teammates bots kiwi routines", icon: <KindIcon widget={{ kind: "kiwi", icon: null }} size={16} />, run: go(() => openTeammates()) },
      { key: "edit", group: "More", label: "Edit widgets", text: "edit layout widgets arrange resize", icon: <IconWidgets size={16} />, run: go(onEditLayout) },
    ];
    out.push(...more.filter((m) => match(m.text)));
    return out;
  }, [q, query, widgets, data, run, onClose, onHome, onOpen, onEditLayout, openSettings, openTeammates]);

  const current = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => {
    list.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      setActive((current + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      items[current]?.run();
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center px-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:pt-[12vh]">
      <motion.div
        className="absolute inset-0 bg-[rgb(20_20_20/0.18)] backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />
      <motion.div
        ref={setPanel}
        role="dialog"
        aria-modal="true"
        aria-label="Search and jump"
        tabIndex={-1}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        className="relative flex max-h-[min(560px,80dvh)] w-full max-w-[580px] flex-col overflow-hidden rounded-[22px] bg-surface shadow-lift outline-none"
      >
        <div className="flex items-center gap-3 border-b border-gray-150 px-4">
          <IconSearch size={18} className="shrink-0 text-gray-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search, jump, or type a new task"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[current] ? `${listId}-${current}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3 focus-visible:outline-none"
          />
          <kbd className="shrink-0 rounded-[6px] bg-gray-100 px-1.5 py-px font-sans text-[11.5px] font-medium text-ink-3 max-sm:hidden">esc</kbd>
        </div>
        <div ref={list} id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
          {items.length === 0 && <p className="px-3 py-8 text-center text-[14px] text-ink-3">Nothing matches that.</p>}
          {items.map((it, i) => {
            const heading = i === 0 || items[i - 1].group !== it.group ? it.group : null;
            return (
              <div key={it.key}>
                {heading && <div className="px-3 pb-1 pt-2.5 text-[11.5px] font-semibold text-gray-500">{heading}</div>}
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === current}
                  data-index={i}
                  tabIndex={-1}
                  onMouseMove={() => i !== current && setActive(i)}
                  onClick={it.run}
                  className={`flex h-10 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[14.5px] transition-colors ${
                    i === current ? "bg-gray-150 text-ink" : "text-ink-2"
                  }`}
                >
                  <span className="flex w-[18px] shrink-0 items-center justify-center text-gray-600">{it.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.meta && <span className="shrink-0 text-[12.5px] text-ink-3">{it.meta}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
