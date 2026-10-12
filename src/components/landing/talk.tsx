import { ChatMock } from "./chat-mock";

export function Talk() {
  return (
    <section className="bg-subtle px-4 py-20 sm:py-28">
      <div className="mx-auto grid max-w-[1080px] items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="mx-auto max-w-[460px] text-center lg:mx-0 lg:text-left">
          <p className="text-[13px] font-medium text-accent">In Grok Bot</p>
          <h2 className="mt-3 text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">
            Most days, you just text Kiwi
          </h2>
          <p className="mt-5 text-pretty text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            Kiwi talks like a good butler, which mostly means short answers and calling you sir. Before it replies it
            re-reads the database, so if you ticked something off by hand a minute ago, it already knows.
          </p>
        </div>
        <ChatMock />
      </div>
    </section>
  );
}
