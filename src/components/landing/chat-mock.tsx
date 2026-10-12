"use client";

import { useEffect, useRef, useState } from "react";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { IconArrowUp } from "@/components/ui/icons";

// A small chat with Kiwi in Grok Bot's bubble style: agent #eeeeee on the
// left, you in near-black on the right. The first time it scrolls into view the
// conversation plays out: your message lands, Kiwi types for a moment, then
// answers. Every bubble keeps its space the whole time, so nothing shifts.
// Without JS, with reduced motion, or if it is already on screen when the page
// loads, the whole conversation is simply shown.

type Line = { from: "you"; text: string } | { from: "kiwi"; text: string; tool: string };

const LINES: Line[] = [
  { from: "you", text: "finished laundry" },
  { from: "kiwi", text: "Done, sir. Laundry is off the list.", tool: "complete_task" },
  { from: "you", text: "remind me to call the bank every day at 10 until I do it" },
  { from: "kiwi", text: "Very good, sir. I'll remind you at 10:00 every day until it's done.", tool: "create_task, set_reminder" },
  { from: "you", text: "add review fluids for tomorrow" },
  { from: "kiwi", text: "Added to Fluid Mechanics, due tomorrow.", tool: "create_task" },
];

const YOU_PAUSE = 550;
const KIWI_TYPING = 950;

export function ChatMock() {
  const ref = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState(LINES.length);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: number[] = [];
    let armed = false;

    function play() {
      let t = 250;
      LINES.forEach((line, i) => {
        if (line.from === "kiwi") {
          timers.push(window.setTimeout(() => setTyping(true), t));
          t += KIWI_TYPING;
        } else if (i > 0) t += YOU_PAUSE;
        timers.push(
          window.setTimeout(() => {
            setTyping(false);
            setShown(i + 1);
          }, t),
        );
      });
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!armed) {
          armed = true;
          if (entry.isIntersecting) {
            io.disconnect();
            return;
          }
          setShown(0);
          return;
        }
        if (entry.isIntersecting) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const bubble = (i: number) =>
    `transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
      i < shown ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-[0.98]"
    }`;

  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[28px] bg-surface shadow-pop">
      <div className="flex items-center gap-2.5 border-b border-ink/[0.06] px-5 py-3.5">
        <KiwiBlob size={30} boinkKey={typing ? shown : null} />
        <div className="leading-tight">
          <p className="text-[14px] font-semibold">Kiwi</p>
          <p className="text-[12px] text-ink-3">{typing ? "typing…" : "Coordinator"}</p>
        </div>
      </div>

      <ol ref={ref} className="space-y-2.5 px-4 py-5" aria-label="Example conversation with Kiwi">
        {LINES.map((l, i) =>
          l.from === "you" ? (
            <li key={i} className={`flex justify-end pl-10 ${bubble(i)}`}>
              <p className="rounded-[20px] rounded-br-[6px] bg-[#070707] px-3.5 py-2 text-[14px] leading-snug text-white">
                <span className="sr-only">You: </span>
                {l.text}
              </p>
            </li>
          ) : (
            <li key={i} className="relative pr-10">
              {typing && i === shown ? <TypingBubble /> : null}
              <div className={`flex flex-col items-start ${bubble(i)}`}>
                <p className="rounded-[20px] rounded-bl-[6px] bg-gray-200 px-3.5 py-2 text-[14px] leading-snug">
                  <span className="sr-only">Kiwi: </span>
                  {l.text}
                </p>
                <p className="mt-1 pl-2 font-mono text-[11px] text-ink-3">
                  <span aria-hidden>↳ </span>
                  {l.tool}
                </p>
              </div>
            </li>
          ),
        )}
      </ol>

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

/** Three dots in a small grey bubble, sitting where Kiwi's reply will land. */
function TypingBubble() {
  return (
    <span aria-hidden className="chat-typing absolute left-0 top-0 inline-flex h-9 items-center gap-1 rounded-[20px] rounded-bl-[6px] bg-gray-200 px-3.5">
      <span className="chat-typing-dot" />
      <span className="chat-typing-dot" />
      <span className="chat-typing-dot" />
    </span>
  );
}
