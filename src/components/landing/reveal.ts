import type { CSSProperties } from "react";

// Scroll reveals: mark an element with `data-reveal` and it fades and rises in
// once, the first time it scrolls into view (see reveal-observer.tsx and the
// `.reveal-armed` rules in globals.css). `revealDelay` staggers siblings.

export const revealDelay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;
