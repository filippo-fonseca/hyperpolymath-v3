import type { CSSProperties } from "react";
import Link from "next/link";
import { Logotype } from "@/components/ui/brand";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { IconArrowRight, IconChevronDown } from "@/components/ui/icons";

const rise = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

export function Hero() {
  return (
    <section className="relative px-4 pb-20 pt-[max(56px,env(safe-area-inset-top))] sm:pb-28 sm:pt-24">
      <Glow />
      <div className="relative mx-auto flex max-w-[760px] flex-col items-center text-center">
        <div className="landing-rise flex items-center gap-2.5" style={rise(0)}>
          <KiwiBlob size={40} title="Kiwi, the coordinator bot" />
          <Logotype className="text-[26px] leading-none" />
        </div>

        <h1
          className="landing-rise mt-10 text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[64px]"
          style={rise(90)}
        >
          Your life, run by a team of Grok&nbsp;Bots.
        </h1>

        <p className="landing-rise mt-6 max-w-[560px] text-pretty text-[17px] leading-relaxed text-ink-2 sm:text-[19px]" style={rise(180)}>
          A calm, one-screen dashboard for tasks, calendar, habits, projects and captures, operated by AI teammates you talk to.
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
            How it works
            <IconChevronDown size={16} className="text-ink-3 transition-transform duration-300 ease-out group-hover:translate-y-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-[-280px] h-[640px] w-[min(900px,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,132,254,0.09),transparent)]" />
    </div>
  );
}
