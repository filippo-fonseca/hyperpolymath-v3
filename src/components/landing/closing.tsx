import Link from "next/link";
import { KiwiBlob } from "@/components/ui/kiwi-blob";
import { IconArrowRight } from "@/components/ui/icons";

export function Closing() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <div data-reveal className="mx-auto flex max-w-[560px] flex-col items-center text-center">
        <KiwiBlob size={56} title="Kiwi" />
        <h2 className="mt-6 text-balance text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[36px]">
          Get your own
        </h2>
        <p className="mt-3 text-balance text-[15px] leading-relaxed text-ink-2">
          Sign up with an email and a password. Your account is private: nobody else sees what&apos;s on it, and bots only get
          in with tokens you make. The code and the Grok Bot setup guide are{" "}
          <a
            href="https://github.com/filippo-fonseca/hyperpolymath-v3"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline underline-offset-4 hover:text-ink-2"
          >
            on GitHub
          </a>
          .
        </p>
        <Link
          href="/login?mode=sign_up"
          className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-white transition-colors hover:bg-gray-800"
        >
          Create an account
          <IconArrowRight size={16} className="transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
        </Link>
        <p className="mt-4 text-[14px] text-ink-2">
          Already have one?{" "}
          <Link href="/login" className="font-medium text-ink underline underline-offset-4 hover:text-ink-2">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
