"use client";

import { useState } from "react";
import { renameBotAction, setCoordinatorAction } from "@/app/actions/teammates";
import { Button, fieldClass } from "@/components/ui/primitives";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { useDashboard } from "@/components/dashboard/context";
import { DOCS, DocLink, Section } from "./shared";

/** Choose and name the main assistant (the coordinator bot). */
export function AssistantSection() {
  const { data, run } = useDashboard();
  const bots = data.bots.filter((b) => !b.archived_at);
  const main = bots.find((b) => b.is_coordinator) ?? null;
  const [name, setName] = useState(main?.name ?? "");
  const [prevMain, setPrevMain] = useState(main?.name);
  if (prevMain !== main?.name) {
    setPrevMain(main?.name);
    setName(main?.name ?? "");
  }
  const [busy, setBusy] = useState(false);
  const renamed = !!main && name.trim() !== "" && name.trim() !== main.name;

  return (
    <div className="flex flex-col gap-8">
      <Section
        id="settings-assistant"
        title="Main assistant"
        hint="The bot you talk to most. It coordinates the others, delivers your reminders, and shows up in the Kiwi widget."
      >
        {bots.length === 0 ? (
          <p className="text-[13.5px] text-ink-3">
            No bots have connected yet. Once your Grok Bot uses the MCP token, it appears here.{" "}
            <DocLink href={DOCS.grokbot}>Setup guide</DocLink>
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <KiwiBlob size={40} />
            <select
              value={main?.name ?? ""}
              onChange={(e) =>
                void run(setCoordinatorAction(e.target.value), { success: `${e.target.value} is now your main assistant` })
              }
              className={`${fieldClass} min-w-0 flex-1 appearance-none`}
              aria-labelledby="settings-assistant-title"
            >
              {!main && <option value="">Choose a bot</option>}
              {bots.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </Section>

      {main && (
        <Section
          id="settings-assistant-name"
          title="Name"
          hint={
            <>
              Kiwi is the default because kiwis are cute. Call yours whatever you want. Rename the bot in Grok Bot too; if you
              only rename it there, it tells Hyperpolymath itself on its next message.
            </>
          }
        >
          <form
            className="flex items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!renamed || busy) return;
              setBusy(true);
              await run(renameBotAction(main.name, name.trim()), { success: `Renamed to ${name.trim()}` });
              setBusy(false);
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className={`${fieldClass} min-w-0 flex-1`}
              aria-labelledby="settings-assistant-name-title"
            />
            <Button type="submit" size="sm" disabled={!renamed || busy}>
              Save
            </Button>
          </form>
        </Section>
      )}
    </div>
  );
}
