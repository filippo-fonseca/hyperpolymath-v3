import type { ReactNode } from "react";

// Shared drawing kit for the Kiwi spot illustrations: palette, the square
// 200x200 canvas, Kiwi herself in line art, and a few small helpers. Scenes are
// drawn in canvas units; at the default 160px a 2.4 unit stroke is ~1.9px.

export type IllustrationProps = { size?: number; className?: string; title?: string };

export const INK = "#141414";
export const PAPER = "#ffffff";
export const MIST = "#f4f4f4";
export const HATCH = "#bdbdbd";
export const ACCENT = "#1084fe";
export const SW = 2.4;

export function Illo({ size = 160, className, title, children }: IllustrationProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
      stroke={INK}
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

// Kiwi's local drawing space is the mascot's own 40x40 box (see kiwi-blob.tsx),
// so the outline matches the app icon exactly.
const BODY =
  "M18.6 6.8c8.6-.3 15 5.6 15.1 13.6.1 7.8-5.9 13.4-14.7 13.6C10.7 34.2 4.3 29.6 4.2 21.9 4.1 13.6 10.3 7.1 18.6 6.8z";

const BEAKS = {
  down: "M33 19.2Q37.6 22 39.8 30.8",
  forward: "M33.2 19.8Q38.6 20.4 43 24.4",
  up: "M33 18.4Q38.4 17 42.4 12.6",
} as const;

const LEGS = {
  stand: "M14.6 31 13.8 37.4 11.6 38.3M13.8 37.4 15.9 38.4M22 31 22.5 37.6 20.5 38.5M22.5 37.6 24.7 38",
  run: "M14.6 31 12 36.6 9.6 36.8M12 36.6 12.6 38.6M22 31 24.6 36.6 22.8 37.8M24.6 36.6 26.8 36.6",
  none: "",
} as const;

const EYE_SHIFT = { open: [0, 0], up: [0.9, -1.6], down: [0.5, 1.6] } as const;

export type KiwiPose = {
  /** Canvas position of Kiwi's local origin. */
  x?: number;
  y?: number;
  s?: number;
  rotate?: number;
  eyes?: "open" | "up" | "down" | "closed";
  beak?: keyof typeof BEAKS;
  legs?: keyof typeof LEGS;
  wing?: boolean;
};

/**
 * Kiwi in line art: white body, black pill eyes, long curved beak, stick legs.
 * Default placement stands her on a ground line at y~161 on the left half.
 * Landmarks at the default pose: body x 30..101, y 84..150; beak base (100,115).
 */
export function KiwiFigure({ x = 20, y = 68, s = 2.4, rotate = 0, eyes = "open", beak = "down", legs = "stand", wing = true }: KiwiPose) {
  const sw = SW / s;
  const shift = eyes === "closed" ? [0, 0] : EYE_SHIFT[eyes];
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${rotate} 19 22)`} strokeWidth={sw}>
      {LEGS[legs] ? <path d={LEGS[legs]} /> : null}
      <path d={BODY} fill={PAPER} />
      <path d="M7.6 27.2l2.6-2.6M9.4 30l3.6-3.6M12.4 32l3.4-3.4M16 33.2l2.6-2.6" stroke={HATCH} strokeWidth={sw * 0.7} />
      {wing ? <path d="M16.4 22.2C12.4 21.4 8.4 24.2 7.2 28.4C11.4 28.8 15.4 26.8 16.4 22.2z" fill={PAPER} /> : null}
      <path d={BEAKS[beak]} strokeWidth={sw * 1.9} />
      {eyes === "closed" ? (
        <path d="M19.8 17.4q1.9 2.2 3.8.4M25.9 16.6q1.7 2 3.5.4" strokeWidth={sw * 1.1} />
      ) : (
        <g fill={INK} stroke="none" transform={`translate(${shift[0]} ${shift[1]})`}>
          <rect x="20.2" y="14.6" width="3" height="7" rx="1.5" transform="rotate(22 21.7 18.1)" />
          <rect x="26.4" y="13.8" width="2.8" height="6.4" rx="1.4" transform="rotate(22 27.8 17)" />
        </g>
      )}
    </g>
  );
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A wing reaching from (x1,y1) to (x2,y2): a tapered, round-tipped mitten.
 * Draw it after Kiwi with the root inside her body so it reads as in front.
 */
export function Wing({ x1, y1, x2, y2, w = 12 }: { x1: number; y1: number; x2: number; y2: number; w?: number }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  const mx = x1 + dx * 0.55;
  const my = y1 + dy * 0.55;
  const t = 0.56;
  const d = [
    `M${r1(x1 + nx)} ${r1(y1 + ny)}`,
    `Q${r1(mx + nx * 1.15)} ${r1(my + ny * 1.15)} ${r1(x2 + nx * t)} ${r1(y2 + ny * t)}`,
    `A${r1((w * t) / 2)} ${r1((w * t) / 2)} 0 0 0 ${r1(x2 - nx * t)} ${r1(y2 - ny * t)}`,
    `Q${r1(mx - nx * 1.15)} ${r1(my - ny * 1.15)} ${r1(x1 - nx)} ${r1(y1 - ny)}`,
  ];
  // The root edge is left unstroked so the wing grows out of the body.
  return (
    <>
      <path d={d.join("") + "z"} fill={PAPER} stroke="none" />
      <path d={d.join("")} />
    </>
  );
}

/** A slightly wavy ground line. */
export function Ground({ x1 = 22, x2 = 178, y = 161 }: { x1?: number; x2?: number; y?: number }) {
  const m = (x1 + x2) / 2;
  return <path d={`M${x1} ${y}Q${(x1 + m) / 2} ${y - 1.4} ${m} ${y}T${x2} ${y - 0.4}`} />;
}

/** A four-point sparkle centered at (x,y). */
export function Sparkle({ x, y, r = 6, color = INK }: { x: number; y: number; r?: number; color?: string }) {
  const k = r * 0.22;
  return (
    <path
      d={`M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}z`}
      fill={color}
      stroke={color}
      strokeWidth={1.2}
    />
  );
}
