import Image from "next/image";

// Who made it: a small author pill with Filippo's portrait, linking to his site.
// Used under the hero buttons and again, quieter, in the footer.

export const AUTHOR_URL = "https://filippofonseca.com";

export function AuthorPill({ quiet = false }: { quiet?: boolean }) {
  return (
    <a
      href={AUTHOR_URL}
      target="_blank"
      rel="noopener"
      className={`group inline-flex items-center gap-2 rounded-full pl-1 pr-3 font-medium transition-colors ${
        quiet ? "h-7 text-[12px] text-ink-3 hover:text-ink" : "h-8 bg-surface text-[13px] text-ink-2 shadow-ring hover:text-ink"
      }`}
    >
      <Image
        src="/filippo.png"
        alt=""
        width={quiet ? 20 : 24}
        height={quiet ? 20 : 24}
        className="shrink-0 rounded-full bg-gray-200 object-cover ring-1 ring-ink/10"
      />
      <span>
        An open-source project by <span className="text-ink">Filippo Fonseca</span>
      </span>
    </a>
  );
}
