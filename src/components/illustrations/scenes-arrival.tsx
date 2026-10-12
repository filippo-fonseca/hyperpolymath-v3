import { ACCENT, Ground, Illo, INK, KiwiFigure, MIST, PAPER, Sparkle, Wing, type IllustrationProps } from "./kiwi-figure";

/** Login: Kiwi holding up a big old key. */
export function KiwiWithKey(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <Ground />
      <KiwiFigure beak="up" eyes="up" wing={false} />
      <g transform="translate(142 58) rotate(14)">
        <path d="M-3.5 19v67.5q0 3 3.5 3t3.5-3V19" fill={PAPER} />
        <path d="M3.5 64h12v7h-5v5h5v9H3.5" fill={PAPER} />
        <rect x="-7" y="13" width="14" height="7" rx="2.5" fill={PAPER} />
        <path d="M0-15c8.5 0 15 6.4 15 14.4S8.5 13.6 0 13.6-15 7.4-15-.6-8.5-15 0-15z" fill={PAPER} />
        <circle cx="0" cy="-.8" r="5.2" fill={MIST} />
      </g>
      <Wing x1={88} y1={132} x2={127} y2={116} />
      <Sparkle x={170} y={36} r={6} color={ACCENT} />
      <Sparkle x={112} y={50} r={3.6} />
    </Illo>
  );
}

/** Magic link sent: Kiwi dashing off with an envelope in her beak. */
export function KiwiMail(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <ellipse cx="70" cy="163" rx="28" ry="3.2" fill={MIST} stroke="none" />
      <path d="M10 102h16M4 117h24M12 132h14" />
      <KiwiFigure y={58} rotate={8} beak="forward" legs="run" />
      <g transform="rotate(-8 136 134)">
        <rect x="112" y="116" width="48" height="34" rx="3" fill={PAPER} />
        <path d="M113 118l23 17 23-17" />
        <path d="M113 149l16-13M159 149l-16-13" stroke={INK} strokeWidth={1.6} />
        <rect x="146" y="121" width="8" height="9" rx="1" fill={ACCENT} stroke="none" />
      </g>
    </Illo>
  );
}

/** 404: Kiwi puzzling over a map that is upside down. */
export function KiwiLost(props: IllustrationProps) {
  return (
    <Illo {...props}>
      <Ground />
      <KiwiFigure beak="up" wing={false} />
      <g transform="translate(-4 54)">
        <path d="M112 54l23-4 23 4 24-4v44l-24 4-23-4-23 4z" fill={PAPER} />
        <path d="M135 50v44l23 4V54z" fill={MIST} />
        <path d="M140 88c6-6 10-14 18-12s12 2 16-8" strokeDasharray="1 5.5" />
        <path d="M170 58l6 6M176 58l-6 6" />
        {/* the north arrow points down: the map is the wrong way up */}
        <path d="M129 58v14M124.5 67.5l4.5 5 4.5-5" strokeWidth={1.8} />
        <path d="M125.6 86v-8.4l6.8 8.4v-8.4" strokeWidth={1.6} />
      </g>
      <Wing x1={88} y1={138} x2={109} y2={142} />
      <path d="M42 50c0-7 5-11.5 11.5-11.5S65 42.6 65 49c0 7.6-10 8.4-10 15.6" />
      <circle cx="55" cy="72" r="1.8" fill={INK} stroke="none" />
    </Illo>
  );
}
