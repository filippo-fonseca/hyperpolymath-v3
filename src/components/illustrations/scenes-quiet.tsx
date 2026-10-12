import { ACCENT, Ground, Illo, KiwiFigure, MIST, PAPER, Wing, type IllustrationProps } from "./kiwi-figure";

const zPath = (x: number, y: number, s: number) => `M${x} ${y}h${s}l${-s} ${s}h${s}`;

/** Nothing due: Kiwi asleep on a pillow. Pass `animated` to let the z's drift. */
export function KiwiSleeping({ animated = false, ...props }: IllustrationProps & { animated?: boolean }) {
  return (
    <Illo {...props}>
      <path
        d="M28 150c-2-12 8-17 24-18 32-2 64-2 96 0 16 1 26 6 24 18 2 12-8 16-24 17-32 2-64 2-96 0-16-1-26-5-24-17z"
        fill={MIST}
      />
      <path d="M28 150c-5-1-8-3-9-6M172 150c5-1 8-3 9-6M28 151c-5 1-8 4-9 7M172 151c5 1 8 4 9 7" strokeWidth={2} />
      <path d="M58 158c20 2 60 2 84 0" strokeWidth={1.6} stroke="#cfcfcf" />
      <KiwiFigure x={30} y={52} rotate={8} eyes="closed" legs="none" />
      <g className={animated ? "illo-zs" : undefined} strokeWidth={2.2}>
        <path className="illo-z" d={zPath(136, 76, 8)} />
        <path className="illo-z" d={zPath(152, 54, 11)} />
        <path className="illo-z" d={zPath(170, 30, 14)} />
      </g>
    </Illo>
  );
}

/** No captures: Kiwi reading an open book, beak on the line. */
export function KiwiReading(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <Ground x1={18} x2={108} />
      <KiwiFigure x={8} eyes="down" />
      <path d="M146 140c-10-6-24-8-38-5l-6 24c14-3 30-1 44 5 14-6 30-8 44-5l-6-24c-14-3-28-1-38 5z" fill={PAPER} />
      <path d="M146 140v24" />
      <path d="M115 143c8-1 16 0 24 2M113 150c8-1 16 0 24 2M154 145c8-2 16-3 24-2M156 152c8-2 16-3 24-2" strokeWidth={1.6} />
      <path d="M170 161v9l3-2.4 3 2.4v-9.6" fill={ACCENT} stroke={ACCENT} strokeWidth={1.4} />
      <path d="M102 159c-2 3-1 5 2 5h84c3 0 4-2 2-5" />
    </Illo>
  );
}

/** No habits: Kiwi watering a sprout. */
export function KiwiWatering(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <Ground />
      <path d="M166 160c4-7 20-7 24 0" fill={MIST} />
      <path d="M178 157c0-5 1-9 0-14" />
      <path d="M178 150c-7-1-11-5-12-10 7 0 11 4 12 10zM178 145c2-6 7-9 13-8-1 6-6 9-13 8z" fill={PAPER} />
      <path d="M172 124v4M179 128v4M170 132v3" stroke={ACCENT} strokeWidth={2.4} />
      <KiwiFigure beak="up" wing={false} />
      <g transform="translate(138 112) rotate(22)">
        <path d="M-9-14c0-13 18-13 18 0" />
        <path d="M14 6l20-14" strokeWidth={5.6} />
        <path d="M14 6l20-14" strokeWidth={1.4} stroke={PAPER} />
        <path d="M31.5-12.5l5 7" strokeWidth={4} />
        <path d="M-14-14h28l3 28h-34z" fill={PAPER} />
        <path d="M-12-6h26" stroke={MIST} strokeWidth={1.6} />
      </g>
      <Wing x1={88} y1={134} x2={123} y2={113} />
    </Illo>
  );
}
