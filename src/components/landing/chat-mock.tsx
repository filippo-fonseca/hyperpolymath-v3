"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { IconArrowUp } from "@/components/ui/icons";

// A small, static chat with Kiwi in Grok Bot's bubble style: agent #eeeeee on
// the left, you in near-black on the right. Messages arrive one after another
// the first time it scrolls into view.

type Line = { from: "you"; text: string } | { from: "kiwi"; text: string; tool: string };

const LINES: Line[] = [
  { from: "you", text: "finished laundry" },
  { from: "kiwi", text: "Marked done, sir. The basket thanks you.", tool: "complete_task" },
  { from: "you", text: "remind me to call the bank every day at 10 until I do it" },
  { from: "kiwi", text: "Daily at 10:00 until it's done, sir. I'll be persistent but polite.", tool: "create_task, set_reminder" },
  { from: "you", text: "add review fluids for tomorrow" },
  { from: "kiwi", text: "Added to Fluid Mechanics, due tomorrow.", tool: "create_task" },
];

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.32, delayChildren: 0.15 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export function ChatMock() {
  const reduce = useReducedMotion();
  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[28px] bg-surface shadow-pop">
      <div className="flex items-center gap-2.5 border-b border-ink/[0.06] px-5 py-3.5">
        <KiwiBlob size={30} />
        <div className="leading-tight">
          <p className="text-[14px] font-semibold">Kiwi</p>
          <p className="text-[12px] text-ink-3">Coordinator</p>
        </div>
      </div>

      <motion.ol
        className="space-y-2.5 px-4 py-5"
        variants={list}
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, amount: 0.35 }}
        aria-label="Example conversation with Kiwi"
      >
        {LINES.map((l, i) =>
          l.from === "you" ? (
            <motion.li key={i} variants={item} className="flex justify-end pl-10">
              <p className="rounded-[20px] rounded-br-[6px] bg-[#070707] px-3.5 py-2 text-[14px] leading-snug text-white">
                <span className="sr-only">You: </span>
                {l.text}
              </p>
            </motion.li>
          ) : (
            <motion.li key={i} variants={item} className="flex flex-col items-start pr-10">
              <p className="rounded-[20px] rounded-bl-[6px] bg-gray-200 px-3.5 py-2 text-[14px] leading-snug">
                <span className="sr-only">Kiwi: </span>
                {l.text}
              </p>
              <p className="mt-1 pl-2 font-mono text-[11px] text-ink-3">
                <span aria-hidden>↳ </span>
                {l.tool}
              </p>
            </motion.li>
          ),
        )}
      </motion.ol>

      <div className="px-4 pb-4" aria-hidden>
        <div className="flex h-11 items-center justify-between rounded-full bg-gray-100 pl-4 pr-1.5">
          <span className="text-[14px] text-ink-3">Message Kiwi</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white">
            <IconArrowUp size={15} />
          </span>
        </div>
      </div>
    </div>
  );
}
