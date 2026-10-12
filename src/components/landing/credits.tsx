import Image from "next/image";

// Who made it: Filippo's portrait, a line linking to his site, his school line
// with a small drawn Yale mark, and icon links to LinkedIn and GitHub. Shown
// under the hero buttons and again, smaller and left-aligned, in the footer.

export const AUTHOR_URL = "https://filippofonseca.com";
const LINKEDIN_URL = "https://linkedin.com/in/filippo-fonseca";
const GITHUB_URL = "https://github.com/filippo-fonseca";

export function AuthorBlock({ compact = false }: { compact?: boolean }) {
  const face = compact ? 32 : 40;
  return (
    <div className={`flex items-center text-left ${compact ? "gap-2.5" : "gap-3"}`}>
      <a href={AUTHOR_URL} target="_blank" rel="noopener" tabIndex={-1} aria-hidden className="shrink-0">
        <Image
          src="/filippo.png"
          alt=""
          width={face}
          height={face}
          className={`rounded-full bg-gray-200 object-cover ring-1 ring-ink/10 ${compact ? "h-8 w-8" : "h-10 w-10"}`}
        />
      </a>
      <div className={`leading-tight ${compact ? "text-[12px]" : "text-[13px]"}`}>
        <p className="text-ink-2">
          An open-source project by{" "}
          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noopener"
            className="font-medium text-ink underline-offset-4 transition-colors hover:underline"
          >
            Filippo Fonseca
          </a>
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-ink-3">
          <YaleMark />
          <span>Yale MechE + EECS &apos;28</span>
          <span aria-hidden className="mx-0.5 text-ink/20">
            ·
          </span>
          <a href={LINKEDIN_URL} target="_blank" rel="noopener" aria-label="Filippo on LinkedIn" className={iconLink}>
            <LinkedInMark />
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener" aria-label="Filippo on GitHub" className={iconLink}>
            <GitHubMark size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}

const iconLink = "-m-1 rounded-[5px] p-1 text-ink-3 transition-colors hover:text-ink";

/** A simple stand-in Yale mark (drawn here, not their logo file): a serif Y
 * on a Yale Blue tile. */
function YaleMark() {
  return (
    <span
      aria-hidden
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-[#00356b] text-[12px] leading-none text-white"
      style={{ fontFamily: "'EB Garamond', Georgia, serif", fontWeight: 600 }}
    >
      Y
    </span>
  );
}

function LinkedInMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export const REPO_URL = "https://github.com/filippo-fonseca/hyperpolymath-v3";

/** The GitHub mark (octocat), drawn inline. Inherits `color`. */
export function GitHubMark({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function SourceLink({ quiet = false }: { quiet?: boolean }) {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors ${
        quiet ? "h-7 text-[12px] text-ink-3 hover:text-ink" : "h-8 bg-surface px-3 text-[13px] text-ink-2 shadow-ring hover:text-ink"
      }`}
    >
      <GitHubMark size={quiet ? 13 : 14} className="shrink-0 text-ink" />
      View source
    </a>
  );
}
