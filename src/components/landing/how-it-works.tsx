import { Diagram } from "./diagram";
import { Steps } from "./steps";

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-8 px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-[1080px]">
        <header className="mx-auto max-w-[760px] text-center">
          <h2 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">
            Where Grok&nbsp;Bot comes in
          </h2>
          <p className="mx-auto mt-5 max-w-[620px] text-pretty text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            Kiwi is a bot in Grok Bot. It hands some jobs to smaller bots, like one that reads Slack every night, and
            all of them read and write the same database through Hyperpolymath&apos;s MCP server. The dashboard is a live
            view of that database, so a task Kiwi adds shows up on your screen about a second later.
          </p>
        </header>
        <div className="mt-14 sm:mt-16">
          <Diagram />
        </div>
        <div className="mt-16 sm:mt-20">
          <Steps />
        </div>
      </div>
    </section>
  );
}
