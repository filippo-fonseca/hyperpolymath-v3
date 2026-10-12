import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import { Logotype } from "@/components/ui/brand";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { KiwiBuilding, KiwiReading, KiwiStargazing, KiwiTeam, KiwiWatering } from "@/components/illustrations";
import { IconArrowRight, IconChevronDown } from "@/components/ui/icons";
import { AuthorPill, SourceLink } from "./credits";

const rise = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

// The headline rises in word by word; on laptops it breaks after "people".
const H1_LINES = [
  ["A", "personal", "life-OS", "for", "people"],
  ["who", "refuse", "to", "specialize."],
];
const H1_START = 160;
const H1_STEP = 45;

export function Hero() {
  return (
    <section className="relative px-4 pb-4 pt-[max(56px,env(safe-area-inset-top))] sm:pb-6 sm:pt-24">
      <Glow />
      <div className="relative mx-auto flex max-w-[1040px] flex-col items-center text-center">
        <div className="flex flex-col items-center">
          <div className="landing-rise flex items-center gap-2.5" style={rise(0)}>
            <KiwiBlob size={40} title="Kiwi, the coordinator bot" />
            <Logotype className="text-[26px] leading-none" />
          </div>
          <a
            href="https://docs.x.ai/grok-bot"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-rise mt-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-surface pl-1 pr-2.5 text-[12px] font-medium text-ink-2 shadow-ring transition-colors hover:text-ink"
            style={rise(80)}
          >
            <GrokBotMark />
            Powered by Grok Bot
          </a>
        </div>

        <h1 className="mt-9 max-w-[760px] text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[60px] lg:max-w-none lg:text-[clamp(60px,4.8vw,68px)]">
          {H1_LINES.map((line, li) => (
            <Fragment key={li}>
              {li > 0 ? <br className="hidden lg:block" /> : null}
              {line.map((word, wi) => {
                const n = H1_LINES.slice(0, li).flat().length + wi;
                return (
                  <Fragment key={word}>
                    <span className="landing-word" style={rise(H1_START + n * H1_STEP)}>
                      {word}
                    </span>
                    {li === H1_LINES.length - 1 && wi === line.length - 1 ? null : " "}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </h1>

        <p className="landing-rise mt-6 max-w-[560px] text-pretty text-[17px] leading-relaxed text-ink-2 sm:text-[19px]" style={rise(520)}>
          A one-screen dashboard for your tasks, calendar, habits, projects and notes that you mostly run by talking to
          Kiwi and the other bots you keep in Grok Bot.
        </p>

        <div className="landing-rise mt-10 flex flex-wrap items-center justify-center gap-3" style={rise(620)}>
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

        <div className="landing-rise mt-6 flex flex-wrap items-center justify-center gap-2" style={rise(700)}>
          <AuthorPill />
          <SourceLink />
        </div>
      </div>

      <Scenes />
    </section>
  );
}

// A row of Kiwi scenes under the buttons, one bot per pursuit, with the team in
// the middle, ground lines aligned. Phones get only the team; tablets add the
// two nearest scenes. Each one pops in, the team first, then outward; the team
// boinks once when it lands. After that they bob gently out of phase, blink and
// twinkle now and then, and tilt with a little boink on hover (globals.css).
const SCENES = [
  { Art: KiwiReading, slot: "mb-[18px] hidden h-[118px] w-[118px] lg:block", delay: 1020 },
  { Art: KiwiBuilding, slot: "mb-[14px] hidden h-[140px] w-[140px] sm:block", delay: 900 },
  { Art: KiwiTeam, slot: "h-[190px] w-[190px] sm:h-[210px] sm:w-[210px]", delay: 780, hero: true },
  { Art: KiwiWatering, slot: "mb-[14px] hidden h-[140px] w-[140px] sm:block", delay: 960 },
  { Art: KiwiStargazing, slot: "mb-[18px] hidden h-[118px] w-[118px] lg:block", delay: 1080 },
];

function Scenes() {
  return (
    <div aria-hidden className="landing-scenes relative mx-auto mt-2 flex max-w-[1000px] items-end justify-center gap-3 sm:mt-4 lg:gap-6">
      {SCENES.map(({ Art, slot, delay, hero }, i) => (
        <div key={i} className={slot}>
          <div className={`landing-pop h-full w-full ${hero ? "landing-pop-boink" : ""}`} style={hero ? { animationDelay: `${delay}ms, ${delay + 620}ms` } : rise(delay)}>
            <div className="scene-float h-full w-full">
              <div className="scene-hover h-full w-full">
                <Art className="h-full w-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
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

/** A soft blue light behind the hero that drifts and breathes very slowly,
 * with a fainter second one wandering out of phase. */
function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="landing-glow absolute left-1/2 top-[-280px] h-[640px] w-[min(900px,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,132,254,0.09),transparent)]" />
      <div className="landing-glow landing-glow-2 absolute left-[58%] top-[120px] hidden h-[460px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(16,132,254,0.045),transparent)] sm:block" />
    </div>
  );
}
