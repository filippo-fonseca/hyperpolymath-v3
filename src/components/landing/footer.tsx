import Link from "next/link";
import { Logotype } from "@/components/ui/brand";

const REPO = "https://github.com/filippo-fonseca/hyperpolymath-v3";

const LINKS = [
  { href: `${REPO}/blob/HEAD/docs/WORKING-WITH-KIWI.md`, label: "Working with Kiwi" },
  { href: `${REPO}/blob/HEAD/docs/GROKBOT-SETUP.md`, label: "Grok Bot setup" },
];

const link = "rounded-sm text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline";

export function Footer() {
  return (
    <footer className="border-t border-ink/[0.06] px-4 pb-[max(40px,env(safe-area-inset-bottom))] pt-10">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Logotype className="text-[20px] leading-none" />
          <p className="mt-3 text-[13px] text-ink-3">
            Private, single-owner app.{" "}
            <a href={REPO} target="_blank" rel="noopener noreferrer" className={link}>
              Open source on GitHub
            </a>
            .
          </p>
        </div>
        <nav aria-label="Guides" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={link}>
              {l.label}
            </a>
          ))}
          <Link href="/login" className={link}>
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
