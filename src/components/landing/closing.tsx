import Link from "next/link";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { IconArrowRight } from "@/components/ui/icons";

export function Closing() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <div className="mx-auto flex max-w-[560px] flex-col items-center text-center">
        <KiwiBlob size={56} title="Kiwi" />
        <h2 className="mt-6 text-balance text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[36px]">
          Ready when you are, sir.
        </h2>
        <p className="mt-3 text-balance text-[15px] text-ink-2">One owner, one dashboard, a small team of bots.</p>
        <Link
          href="/login"
          className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-white transition-colors hover:bg-gray-800"
        >
          Sign in
          <IconArrowRight size={16} className="transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
