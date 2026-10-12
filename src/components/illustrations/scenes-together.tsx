import { ACCENT, Ground, HATCH, Illo, INK, KiwiFigure, MIST, PAPER, Sparkle, Wing, type IllustrationProps } from "./kiwi-figure";

/** Calendar empty or not connected: Kiwi at a telescope under the stars. */
export function KiwiStargazing(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <Ground />
      <path d="M40 22a17 17 0 1 0 14 26 13.5 13.5 0 1 1-14-26z" fill={MIST} />
      <Sparkle x={184} y={30} r={6} color={ACCENT} />
      <Sparkle x={96} y={30} r={4.4} />
      <Sparkle x={140} y={22} r={3.4} />
      <circle cx="78" cy="58" r="1.6" fill={INK} stroke="none" />
      <circle cx="160" cy="88" r="1.6" fill={INK} stroke="none" />
      <circle cx="118" cy="50" r="1.4" fill={INK} stroke="none" />
      <path d="M136 84l-16 76M136 84l2 76M136 84l20 76" />
      <KiwiFigure beak="up" eyes="up" />
      <g transform="translate(108 96) rotate(-38)">
        <path d="M0-5h14v10H0z" fill={PAPER} />
        <path d="M14-7.5l50-3.5v22l-50-3.5z" fill={PAPER} />
        <path d="M64-12.5h7v25h-7z" fill={PAPER} />
        <path d="M24-4l30-2" stroke={HATCH} strokeWidth={1.6} />
      </g>
    </Illo>
  );
}

/** No projects: Kiwi stacking blocks. */
export function KiwiBuilding(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <Ground />
      <rect x="126" y="126" width="38" height="34" rx="3" fill={PAPER} />
      <path d="M137 150l8-16 8 16M140 145h10" strokeWidth={2} />
      <g transform="rotate(4 147 112)">
        <rect x="132" y="96" width="30" height="30" rx="3" fill={MIST} />
        <circle cx="147" cy="111" r="7" stroke={ACCENT} strokeWidth={2.2} />
      </g>
      <KiwiFigure beak="up" wing={false} />
      <g transform="rotate(-10 138 78)">
        <rect x="124" y="64" width="28" height="28" rx="3" fill={PAPER} />
        <path d="M131 71l14 14M145 71l-14 14" stroke={HATCH} strokeWidth={1.6} />
      </g>
      <Wing x1={88} y1={134} x2={124} y2={96} />
      <path d="M118 52l-4-6M132 48v-7M146 52l4-6" strokeWidth={2} />
    </Illo>
  );
}

/** A plain friend blob in the Grok Bot style: no beak, two tilted pill eyes. */
function Friend({ d, eyes, tilt, fill = PAPER }: { d: string; eyes: [number, number][]; tilt: number; fill?: string }) {
  return (
    <>
      <path d={d} fill={fill} />
      {eyes.map(([x, y]) => (
        <rect key={x} x={x - 3.4} y={y - 8} width="6.8" height="16" rx="3.4" fill={INK} stroke="none" transform={`rotate(${tilt} ${x} ${y})`} />
      ))}
    </>
  );
}

/** Teammates / Grok Bot setup: Kiwi with two blob friends. */
export function KiwiTeam(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <Ground x1={14} x2={186} />
      <Friend d="M36 118c14 0 22 10 22 22 0 12-8 20-22 20s-22-8-22-20c0-12 8-22 22-22z" eyes={[[40, 136], [50, 134]]} tilt={18} fill={MIST} />
      <Friend d="M168 96c12 0 19 12 19 30 0 20-7 34-19 34s-21-12-21-34c0-18 9-30 21-30z" eyes={[[158, 120], [169, 118]]} tilt={-18} />
      <Wing x1={182} y1={138} x2={195} y2={124} w={9} />
      <KiwiFigure x={56} y={84} s={2} />
      <Sparkle x={106} y={66} r={5} color={ACCENT} />
      <Sparkle x={70} y={80} r={3} />
    </Illo>
  );
}
