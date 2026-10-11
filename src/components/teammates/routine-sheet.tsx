"use client";

import { useEffect, useState } from "react";
import type { Bot, RoutineRow, RoutineRun } from "@/lib/dashboard-types";
import { isCustomKind } from "@/lib/widgets";
import { scheduleInWords } from "@/lib/cron-words";
import { listRunsAction, registerRoutineAction, removeRoutineAction, updateRoutineAction } from "@/app/actions/teammates";
import { Button, EmptyNote, Switch, fieldClass } from "@/components/ui/primitives";
import { useDashboard } from "@/components/dashboard/context";
import { ConfirmCard, Field, SectionTitle, selectClass, selectStyle, textareaClass } from "./form";
import { RunDot, runState } from "./routine-utils";

/** Edit a registered routine, see its run history, or remove it. */
export function RoutineEditor({ routineId, onDone }: { routineId: string; onDone: () => void }) {
  const { data } = useDashboard();
  const routine = data.routines.find((r) => r.id === routineId);
  const bot = routine ? data.bots.find((b) => b.id === routine.bot_id) : undefined;
  if (!routine || !bot) return <EmptyNote>This routine was removed.</EmptyNote>;
  return <RoutineForm key={routine.id} bot={bot} routine={routine} onDone={onDone} />;
}

/** Register a routine by hand for a bot (one you set up in Grok Bot yourself). */
export function NewRoutine({ botId, onDone }: { botId: string; onDone: () => void }) {
  const { data } = useDashboard();
  const bot = data.bots.find((b) => b.id === botId);
  if (!bot) return <EmptyNote>This teammate was archived or removed.</EmptyNote>;
  return <RoutineForm key={bot.id} bot={bot} routine={null} onDone={onDone} />;
}

function RoutineForm({ bot, routine, onDone }: { bot: Bot; routine: RoutineRow | null; onDone: () => void }) {
  const { data, nowMs, run } = useDashboard();
  const [name, setName] = useState(routine?.name ?? "");
  const [schedule, setSchedule] = useState(routine?.schedule ?? "");
  const [description, setDescription] = useState(routine?.description ?? "");
  const [widget, setWidget] = useState(routine?.widget_id ?? "");
  const [enabled, setEnabled] = useState(routine?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const widgets: { id: string; title: string }[] = data.widgets.filter((w) => isCustomKind(w.kind));
  if (routine?.widget && !widgets.some((w) => w.id === routine.widget!.id)) widgets.push(routine.widget);
  const words = scheduleInWords(schedule);
  const showWords = schedule.trim() && words.toLowerCase() !== schedule.trim().toLowerCase();
  const state = routine ? runState(routine.last_status, routine.last_run_at, nowMs) : null;

  const patch: Parameters<typeof updateRoutineAction>[1] = {};
  if (routine) {
    if (name.trim() !== routine.name) patch.name = name;
    if (schedule.trim() !== (routine.schedule ?? "")) patch.schedule = schedule;
    if (description.trim() !== (routine.description ?? "")) patch.description = description;
    if ((widget || null) !== routine.widget_id) patch.widget = widget || null;
    if (enabled !== routine.enabled) patch.enabled = enabled;
  }
  const canSave = name.trim().length > 0 && (!routine || Object.keys(patch).length > 0);

  const save = async () => {
    setBusy(true);
    const ok = routine
      ? await run(updateRoutineAction(routine.id, patch), { success: `Saved “${name.trim()}”` })
      : await run(
          registerRoutineAction({ bot: bot.name, name, schedule, description, widget: widget || null }),
          { success: `Added “${name.trim()}” to ${bot.name}` },
        );
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <div className="flex flex-col gap-7 pb-2">
      {routine && state && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <RunDot className={state.dot} />
            {state.text}
          </span>
          <span className="text-gray-300">·</span>
          <span>
            {routine.run_count} {routine.run_count === 1 ? "run" : "runs"}
          </span>
          {routine.grokbot_routine_id && (
            <>
              <span className="text-gray-300">·</span>
              <span className="max-w-full truncate font-mono text-[11.5px] text-ink-3">{routine.grokbot_routine_id}</span>
            </>
          )}
        </div>
      )}

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave && !busy) void save();
        }}
      >
        {!routine && (
          <p className="text-[13px] leading-snug text-ink-3">
            For a routine you set up in Grok Bot yourself. Tell {bot.name} its name so it checks in here before each run.
          </p>
        )}
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nightly Slack scan"
            maxLength={120}
            required
            autoFocus={!routine}
            className={`${fieldClass} w-full`}
          />
        </Field>
        <Field
          label="Schedule"
          hint={showWords ? `Reads as: ${words}` : "In words, like “Every night at 10pm”, or a cron line."}
        >
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="Every night at 10pm"
            maxLength={200}
            className={`${fieldClass} w-full`}
          />
        </Field>
        <Field label="What it does">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Scans my Slack workspaces for messages I missed"
            maxLength={2000}
            rows={3}
            className={textareaClass}
          />
        </Field>
        <Field label="Publishes to" hint={widgets.length === 0 ? "No custom widgets yet. Bots create them when you ask." : undefined}>
          <select value={widget} onChange={(e) => setWidget(e.target.value)} className={selectClass} style={selectStyle}>
            <option value="">No widget</option>
            {widgets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
        </Field>
        {routine && (
          <div className="flex items-center justify-between gap-4 rounded-[14px] bg-gray-100 px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-[14px] font-medium">{enabled ? "On" : "Paused"}</div>
              <div className="text-[12.5px] leading-snug text-ink-3">
                {enabled ? `${bot.name} runs it on schedule.` : `${bot.name} skips it when it checks in.`}
              </div>
            </div>
            <Switch checked={enabled} onChange={setEnabled} label={enabled ? "Pause routine" : "Resume routine"} />
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="dark" disabled={!canSave || busy}>
            {busy ? "Saving…" : routine ? "Save" : "Add routine"}
          </Button>
        </div>
      </form>

      {routine && <RunHistory routine={routine} />}

      {routine &&
        (confirmRemove ? (
          <ConfirmCard
            text={`Remove “${routine.name}” from Hyperpolymath? This doesn't delete it in Grok Bot; ask ${bot.name} to do that.`}
            action="Remove"
            busy={busy}
            onCancel={() => setConfirmRemove(false)}
            onConfirm={async () => {
              setBusy(true);
              const ok = await run(removeRoutineAction(routine.id), { success: `Removed “${routine.name}”` });
              setBusy(false);
              if (ok) onDone();
            }}
          />
        ) : (
          <Button variant="danger" className="self-start" onClick={() => setConfirmRemove(true)}>
            Remove routine
          </Button>
        ))}
    </div>
  );
}

function duration(run: RoutineRun) {
  if (!run.finished_at) return null;
  const s = Math.max(0, Math.round((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

function RunHistory({ routine }: { routine: RoutineRow }) {
  const { data, nowMs, run } = useDashboard();
  const [runs, setRuns] = useState<RoutineRun[] | null>(null);

  // Refetch on every realtime refresh (start and finish calls touch routine_runs).
  useEffect(() => {
    let live = true;
    void run(listRunsAction(routine.id), { quiet: true }).then((r) => {
      if (live && r) setRuns(r);
    });
    return () => {
      live = false;
    };
  }, [routine.id, run, data.routines]);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: data.tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <section>
      <SectionTitle>Recent runs</SectionTitle>
      {runs === null ? (
        <div className="skeleton h-10 rounded-[12px]" />
      ) : runs.length === 0 ? (
        <p className="text-[13.5px] leading-snug text-ink-3">
          No runs reported yet. The bot reports each run when it starts and finishes.
        </p>
      ) : (
        <ol className="divide-y divide-gray-150">
          {runs.map((r) => {
            const s = runState(r.status, r.started_at, nowMs);
            const d = duration(r);
            return (
              <li key={r.id} className="py-2.5">
                <div className="flex items-center gap-2 text-[13.5px]">
                  <RunDot className={s.dot} />
                  <span className="font-medium">{s.text}</span>
                  <span className="ml-auto shrink-0 text-[12px] tabular-nums text-ink-3">
                    {fmt.format(new Date(r.started_at))}
                    {d ? ` · ${d}` : ""}
                  </span>
                </div>
                {r.summary && <p className="mt-0.5 pl-3.5 text-[13px] leading-snug text-ink-2">{r.summary}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
