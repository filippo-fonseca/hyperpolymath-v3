// The loader: Kiwi's eyes (Grok Bot style tilted pills) blinking and
// glancing, while ink sweeps across and inverts black and white, and a brush
// stroke paints itself around them. Pure CSS, no JS timers.

function Eyes({ ink }: { ink: string }) {
  return (
    <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden>
      <g className="kl-glance">
        <g className="kl-blink" fill={ink}>
          <rect x="12.2" y="12.5" width="5.4" height="13" rx="2.7" transform="rotate(20 14.9 19)" />
          <rect x="22.6" y="11.8" width="5" height="12" rx="2.5" transform="rotate(20 25.1 17.8)" />
        </g>
      </g>
    </svg>
  );
}

export function KiwiLoader({ size = 48, label = "Loading", className = "" }: { size?: number; label?: string; className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* paper layer: black eyes on white */}
      <span className="absolute inset-[12%] overflow-hidden rounded-full bg-white shadow-[inset_0_0_0_1.5px_#141414]">
        <Eyes ink="#141414" />
      </span>
      {/* ink layer: white eyes on black, wiped across like a brush */}
      <span className="kl-ink absolute inset-[12%] overflow-hidden rounded-full bg-[#141414]">
        <Eyes ink="#ffffff" />
      </span>
      {/* the painted ring */}
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full" aria-hidden>
        <path
          className="kl-brush"
          d="M24 3.2c11.9-.4 21.2 9 20.9 20.9-.3 11.4-9.6 20.6-21 20.6C12.4 44.7 3 35.4 3.3 23.8 3.6 12.7 12.2 3.6 23.3 3.4"
          fill="none"
          stroke="#141414"
          strokeWidth="2.6"
          strokeLinecap="round"
          pathLength={100}
        />
        <path
          className="kl-brush kl-brush-2"
          d="M23 5.6c10.6.1 18.9 8.4 18.7 18.8-.2 10.2-8.6 18.4-18.8 18.2"
          fill="none"
          stroke="#141414"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.5"
          pathLength={100}
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Full-area centered loader for pages, sheets and Suspense fallbacks. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-3">
      <KiwiLoader size={56} label={label} />
      <span className="text-[13px] text-ink-3">{label}…</span>
    </div>
  );
}
