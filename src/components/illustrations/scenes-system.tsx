import { ACCENT, Ground, HATCH, Illo, INK, KiwiFigure, MIST, PAPER, Wing, type IllustrationProps } from "./kiwi-figure";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A gear outline with `n` teeth; teeth listed in `missing` have snapped off. */
function gearPath(cx: number, cy: number, rIn: number, rOut: number, n: number, missing: number[] = []) {
  const step = (2 * Math.PI) / n;
  const at = (r: number, a: number) => `${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2;
    const base = step * 0.27;
    const top = step * 0.17;
    if (missing.includes(i)) pts.push(at(rIn, a - base), at(rIn - 1.5, a), at(rIn, a + base));
    else pts.push(at(rIn, a - base), at(rOut, a - top), at(rOut, a + top), at(rIn, a + base));
  }
  return `M${pts.join("L")}z`;
}

/** Error: Kiwi with a wrench, tending a gear that lost a tooth. */
export function KiwiFixing(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <Ground />
      <path d={gearPath(158, 128, 22, 30, 9, [3])} fill={PAPER} />
      <circle cx="158" cy="128" r="8" fill={MIST} />
      <path d="M150 103l-3 7 5 3-4 7" strokeWidth={1.8} />
      {/* the tooth that came off */}
      <path d="M181 160l2-8 8 1 1 7" fill={PAPER} strokeWidth={2} />
      <KiwiFigure beak="up" wing={false} />
      <g transform="translate(104 132) rotate(-32)">
        <path d="M34.7-3.6A10 10 0 0 1 52.9-4.5H46v9h6.9a10 10 0 0 1-18.2-.9H0Q-3.6 3.6-3.6 0T0-3.6z" fill={PAPER} />
      </g>
      <Wing x1={86} y1={134} x2={114} y2={127} />
      <path d="M128 70l4-8M140 72l8-6M120 74l-2-8" strokeWidth={2} />
    </Illo>
  );
}

/** Offline: Kiwi holding a plug that has come out of the wall. */
export function KiwiOffline(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <Ground x2={186} />
      <path d="M186 52v108" />
      <rect x="164" y="86" width="22" height="34" rx="5" fill={MIST} />
      <path d="M172 96v5M178 96v5" strokeWidth={2.6} />
      <circle cx="175" cy="111" r="1.6" fill={INK} stroke="none" />
      {/* the cord: from the plug, down to the floor and away behind Kiwi */}
      <path d="M126 130c-2 12 6 18 2 26-3 5-14 5-24 5" />
      <KiwiFigure beak="up" eyes="open" wing={false} />
      <rect x="118" y="108" width="17" height="22" rx="4" fill={PAPER} />
      <path d="M135 113h7M135 124h7" strokeWidth={2.6} />
      <Wing x1={88} y1={132} x2={119} y2={122} />
      <path d="M148 112l5-2-2 5 5-2" stroke={ACCENT} strokeWidth={2} />
      <path d="M150 96l3 4M152 128l3-3" strokeWidth={1.8} />
    </Illo>
  );
}

/** Widget waiting for its first publish: Kiwi keeps an eye on an hourglass. */
export function KiwiWaiting(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <Ground />
      <KiwiFigure eyes="open" />
      <g transform="translate(2 0)">
        <path d="M134 80c0 18 14 26 18 36-4 10-18 18-18 36M170 80c0 18-14 26-18 36 4 10 18 18 18 36" />
        <path d="M139 96h26c-3 7-10 13-13 18-3-5-10-11-13-18z" fill={HATCH} stroke="none" />
        <path d="M152 118v28" stroke={ACCENT} strokeWidth={1.8} strokeDasharray="2 4" />
        <path d="M138 152c4-9 9-12 14-12s10 3 14 12z" fill={MIST} />
        <rect x="126" y="72" width="52" height="8" rx="3" fill={PAPER} />
        <rect x="126" y="152" width="52" height="8" rx="3" fill={PAPER} />
      </g>
      <path d="M58 44h36q6 0 6 6v12q0 6-6 6H74l-7 7v-7h-9q-6 0-6-6V50q0-6 6-6z" fill={PAPER} />
      <circle cx="66" cy="56" r="2.4" fill={INK} stroke="none" />
      <circle cx="76" cy="56" r="2.4" fill={INK} stroke="none" />
      <circle cx="86" cy="56" r="2.4" fill={INK} stroke="none" />
    </Illo>
  );
}
