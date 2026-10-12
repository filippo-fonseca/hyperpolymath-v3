import type { CSSProperties } from "react";
import Link from "next/link";
import { Logotype } from "@/components/ui/brand";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { KiwiBuilding, KiwiReading, KiwiStargazing, KiwiTeam, KiwiWatering } from "@/components/illustrations";
import { IconArrowRight, IconChevronDown } from "@/components/ui/icons";
import { AuthorPill } from "./credits";

const rise = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

export function Hero() {
  return (
    <section className="relative px-4 pb-4 pt-[max(56px,env(safe-area-inset-top))] sm:pb-6 sm:pt-24">
      <Glow />
      <div className="relative mx-auto flex max-w-[760px] flex-col items-center text-center">
        <div className="landing-rise flex flex-col items-center" style={rise(0)}>
          <div className="flex items-center gap-2.5">
            <KiwiBlob size={40} title="Kiwi, the coordinator bot" />
            <Logotype className="text-[26px] leading-none" />
          </div>
          <a
            href="https://docs.x.ai/grok-bot"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-surface pl-1 pr-2.5 text-[12px] font-medium text-ink-2 shadow-ring transition-colors hover:text-ink"
          >
            <GrokBotMark />
            Powered by Grok Bot
          </a>
        </div>

        <h1
          className="landing-rise mt-9 text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[60px]"
          style={rise(90)}
        >
          A personal <span className="whitespace-nowrap">life-OS</span> for people who refuse to specialize.
        </h1>

        <p className="landing-rise mt-6 max-w-[560px] text-pretty text-[17px] leading-relaxed text-ink-2 sm:text-[19px]" style={rise(180)}>
          A one-screen dashboard for your tasks, calendar, habits, projects and notes that you mostly run by talking to
          Kiwi and the other bots you keep in Grok Bot.
        </p>

        <div className="landing-rise mt-10 flex flex-wrap items-center justify-center gap-3" style={rise(270)}>
          <Link
            href="/login"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-white transition-colors hover:bg-gray-800"
          >
            Sign in
            <IconArrowRight size={16} className="transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#how"
            className="group inline-flex h-12 items-center gap-1.5 rounded-full px-5 text-[15px] font-medium text-ink shadow-ring transition-colors hover:bg-gray-100"
          >
            See how it&apos;s wired
            <IconChevronDown size={16} className="text-ink-3 transition-transform duration-300 ease-out group-hover:translate-y-0.5" />
          </a>
        </div>

        <div className="landing-rise mt-6 flex flex-wrap items-center justify-center gap-2" style={rise(320)}>
          <AuthorPill />
        </div>
      </div>

      <Scenes />
    </section>
  );
}

// A row of Kiwi scenes under the buttons, one bot per pursuit, with the team in
// the middle, ground lines aligned. Phones get only the team; tablets add the two nearest scenes.
const scene = "h-full w-full";

function Scenes() {
  return (
    <div
      aria-hidden
      className="landing-rise relative mx-auto mt-2 flex max-w-[1000px] items-end justify-center gap-3 sm:mt-4 lg:gap-6"
      style={rise(400)}
    >
      <div className="mb-[18px] hidden h-[118px] w-[118px] lg:block">
        <KiwiReading className={scene} />
      </div>
      <div className="mb-[14px] hidden h-[140px] w-[140px] sm:block">
        <KiwiBuilding className={scene} />
      </div>
      <div className="h-[190px] w-[190px] sm:h-[210px] sm:w-[210px]">
        <KiwiTeam className={scene} />
      </div>
      <div className="mb-[14px] hidden h-[140px] w-[140px] sm:block">
        <KiwiWatering className={scene} />
      </div>
      <div className="mb-[18px] hidden h-[118px] w-[118px] lg:block">
        <KiwiStargazing className={scene} />
      </div>
    </div>
  );
}

/** A small stand-in mark for Grok Bot (drawn here, not their asset): a dark
 * tile with a glossy light blob and two tilted pill eyes. */
function GrokBotMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <defs>
        <radialGradient id="grokbot-gloss" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9d9d9" />
        </radialGradient>
      </defs>
      <rect width="18" height="18" rx="5" fill="#141414" />
      <path d="M9.2 3.6c3.3 0 5.2 2 5.2 5.1 0 3.3-2.2 5.7-5.5 5.7S3.6 12.3 3.6 9.1c0-3.2 2.3-5.5 5.6-5.5z" fill="url(#grokbot-gloss)" />
      <rect x="6.3" y="7" width="1.7" height="3.4" rx="0.85" fill="#141414" transform="rotate(-14 7.15 8.7)" />
      <rect x="10" y="7" width="1.7" height="3.4" rx="0.85" fill="#141414" transform="rotate(-14 10.85 8.7)" />
    </svg>
  );
}

function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-[-280px] h-[640px] w-[min(900px,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,132,254,0.09),transparent)]" />
    </div>
  );
}
