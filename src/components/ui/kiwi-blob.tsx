"use client";

import { useId, useState } from "react";

// Kiwi as a little blob in the style of the Grok Bot logo: a colorless,
// glossy white-to-gray body with two black tilted pill eyes, plus a kiwi's
// long beak and tiny feet. It "boinks" (squash and stretch) when tapped,
// hovered, or whenever `boinkKey` changes (e.g. Kiwi just did something), and
// blinks now and then.

const INK = "#141414";
const GRAPHITE = "#5a5a5a";

export function KiwiBlob({
  size = 32,
  boinkKey,
  interactive = true,
  className = "",
  title = "Kiwi",
}: {
  size?: number;
  /** Change this value to make Kiwi boink (e.g. pass the latest action id). */
  boinkKey?: string | number | null;
  interactive?: boolean;
  className?: string;
  title?: string;
}) {
  const [boinks, setBoinks] = useState(0);
  // Boink when the key changes (adjusting state during render, not in an effect).
  const [seenKey, setSeenKey] = useState(boinkKey);
  if (boinkKey !== seenKey) {
    setSeenKey(boinkKey);
    if (boinkKey != null) setBoinks((n) => n + 1);
  }

  const boink = () => setBoinks((n) => n + 1);
  const gid = `kiwi-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  return (
    <span
      className={`kiwi-blob inline-flex shrink-0 ${interactive ? "cursor-pointer" : ""} ${className}`}
      style={{ width: size, height: size }}
      onClick={interactive ? boink : undefined}
      onMouseEnter={interactive ? boink : undefined}
      role="img"
      aria-label={title}
    >
      <svg
        key={boinks}
        viewBox="0 0 40 40"
        width={size}
        height={size}
        className={boinks ? "kiwi-boink" : undefined}
        style={{ overflow: "visible" }}
      >
        <defs>
          <radialGradient id={`${gid}-body`} cx="34%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="48%" stopColor="#ececec" />
            <stop offset="100%" stopColor="#b4b4b4" />
          </radialGradient>
        </defs>
        {/* feet, drawn first so the body sits on them */}
        <g stroke={GRAPHITE} strokeWidth="1.8" strokeLinecap="round" fill="none">
          <path d="M14.5 31.5 L13.6 36.6 M13.6 36.6 L11.6 37.4 M13.6 36.6 L15.4 37.6" />
          <path d="M22 31.8 L22.6 36.8 M22.6 36.8 L20.8 37.8 M22.6 36.8 L24.6 37.4" />
        </g>
        {/* body */}
        <path
          d="M18.6 6.8c8.6-.3 15 5.6 15.1 13.6.1 7.8-5.9 13.4-14.7 13.6C10.7 34.2 4.3 29.6 4.2 21.9 4.1 13.6 10.3 7.1 18.6 6.8z"
          fill={`url(#${gid}-body)`}
          stroke="rgba(20,20,20,0.10)"
          strokeWidth="0.6"
        />
        {/* beak */}
        <path d="M31.4 19.6 Q36.2 22.4 38.6 29.4" stroke={GRAPHITE} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        {/* eyes: tilted pills, like the Grok Bot face */}
        <g className="kiwi-eyes" fill={INK}>
          <rect x="20.2" y="14.6" width="3" height="7" rx="1.5" transform="rotate(22 21.7 18.1)" />
          <rect x="26.4" y="13.8" width="2.8" height="6.4" rx="1.4" transform="rotate(22 27.8 17)" />
        </g>
      </svg>
    </span>
  );
}
