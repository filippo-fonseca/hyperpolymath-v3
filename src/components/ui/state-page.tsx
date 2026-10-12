import type { ReactNode } from "react";
import { Logotype } from "./brand";

// Full-screen calm state (404, errors): wordmark, a Kiwi scene, a headline,
// a line of copy and the next step. No hooks, so server and client pages share it.

export function StatePage({
  art,
  title,
  children,
  actions,
}: {
  art: ReactNode;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 pb-[max(48px,env(safe-area-inset-bottom))] pt-[max(48px,env(safe-area-inset-top))]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-20%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,132,254,0.08),transparent)]" />
      </div>
      <div className="relative flex w-full max-w-[420px] flex-col items-center text-center">
        <div className="text-[19px] leading-none text-ink">
          <Logotype />
        </div>
        <div className="mt-10">{art}</div>
        <h1 className="mt-5 text-[24px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        <div className="mt-2 text-[15px] leading-relaxed text-ink-2">{children}</div>
        <div className="mt-7 flex w-full flex-col items-center justify-center gap-2 min-[400px]:flex-row">{actions}</div>
      </div>
    </main>
  );
}

/** Primary pill styled like the dashboard's dark button, for links and buttons alike. */
export const statePrimary =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14.5px] font-medium text-white transition hover:bg-gray-900 active:scale-[0.985] min-[400px]:w-auto";
export const stateSecondary =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gray-150 px-5 text-[14.5px] font-medium text-ink transition hover:bg-gray-200 active:scale-[0.985] min-[400px]:w-auto";
