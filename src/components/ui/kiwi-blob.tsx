"use client";

import { useState } from "react";

// Kiwi as a little blob, in the style of Grok Bot's bot faces: a round brown
// body, two white eyes looking toward a long beak, tiny feet. It "boinks"
// (squash and stretch) when tapped, when hovered, and whenever `boinkKey`
// changes (e.g. Kiwi just did something). It also blinks now and then.

const BODY = "#8a6748";
const BELLY = "#a8825f";
const BEAK = "#e3c08f";
const FEET = "#d9ad78";

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
        {/* feet, drawn first so the body sits on them */}
        <g stroke={FEET} strokeWidth="1.9" strokeLinecap="round" fill="none">
          <path d="M14.5 31.5 L13.6 36.6 M13.6 36.6 L11.6 37.4 M13.6 36.6 L15.4 37.6" />
          <path d="M22 31.8 L22.6 36.8 M22.6 36.8 L20.8 37.8 M22.6 36.8 L24.6 37.4" />
        </g>
        {/* body */}
        <path
          d="M18.6 6.8c8.6-.3 15 5.6 15.1 13.6.1 7.8-5.9 13.4-14.7 13.6C10.7 34.2 4.3 29.6 4.2 21.9 4.1 13.6 10.3 7.1 18.6 6.8z"
          fill={BODY}
        />
        {/* soft belly highlight */}
        <ellipse cx="15" cy="26.4" rx="6.6" ry="4.2" fill={BELLY} opacity="0.32" />
        {/* beak */}
        <path d="M31.2 19.4 Q36.2 22.4 38.6 29.4" stroke={BEAK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        {/* blush */}
        <ellipse cx="28.6" cy="23.6" rx="2.2" ry="1.3" fill="#ff8fa3" opacity="0.45" />
        {/* eyes */}
        <g className="kiwi-eyes">
          <ellipse cx="21.6" cy="17.6" rx="2.5" ry="3.2" fill="#fff" />
          <ellipse cx="28" cy="17.4" rx="2.3" ry="3" fill="#fff" />
          <circle cx="22.4" cy="18.1" r="1.25" fill="#141414" />
          <circle cx="28.7" cy="17.9" r="1.15" fill="#141414" />
        </g>
      </svg>
    </span>
  );
}
