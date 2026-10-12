import { Diagram } from "./diagram";

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-8 px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-[1080px]">
        <header className="mx-auto max-w-[760px] text-center">
          <p className="text-[13px] font-medium text-accent">How Grok Bot is leveraged</p>
          <h2 className="mt-3 text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">
            Grok Bot does the work. Hyperpolymath keeps the record.
          </h2>
          <p className="mx-auto mt-5 max-w-[620px] text-pretty text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            Kiwi lives in Grok Bot and coordinates a small team of bots. They all read and write one database through
            Hyperpolymath&apos;s MCP server, and the dashboard shows the result the moment it lands.
          </p>
        </header>
        <div className="mt-14 sm:mt-16">
          <Diagram />
        </div>
      </div>
    </section>
  );
}
