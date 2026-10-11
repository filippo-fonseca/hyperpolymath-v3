import { KiwiBlob } from "./kiwi-blob";

// Shape avatars with two dot eyes, in the spirit of Grok Bot's bot faces.
// Kiwi (the coordinator) is the kiwi blob instead.

export const AVATAR_COLORS: Record<string, string> = {
  blue: "#1084fe",
  green: "#2fb26b",
  orange: "#ff8a1f",
  magenta: "#e5399b",
  violet: "#8b5cf6",
  cyan: "#12b5c8",
  red: "#ff4757",
  brown: "#a8754f",
};

const SHAPES: Record<string, { d: string; eyes: [number, number, number] }> = {
  // eyes: [left x, right x, y]
  blob: {
    d: "M20 3.5c7.6 0 14.6 4.4 15.9 11.6 1.4 7.6-2.5 15.9-9.4 19.3-5.8 2.9-13.4 2.6-18.2-1.9C3.6 28 2.6 20.6 4.6 14.5 6.6 8.1 12.6 3.5 20 3.5z",
    eyes: [15, 25, 18.5],
  },
  squircle: {
    d: "M20 4c11.5 0 16 4.5 16 16s-4.5 16-16 16S4 31.5 4 20 8.5 4 20 4z",
    eyes: [15, 25, 19],
  },
  hex: {
    d: "M17.6 4.6a4.8 4.8 0 014.8 0l10.4 6a4.8 4.8 0 012.4 4.2v10.4a4.8 4.8 0 01-2.4 4.2l-10.4 6a4.8 4.8 0 01-4.8 0l-10.4-6a4.8 4.8 0 01-2.4-4.2V14.8a4.8 4.8 0 012.4-4.2z",
    eyes: [15.2, 24.8, 19.5],
  },
  pebble: {
    d: "M21.5 5c8.2.5 14.2 6.4 14 14.4-.2 8.6-7.3 15.4-16 15.6C11 35.2 4.6 29.3 4.5 21.6 4.4 12 11.8 4.4 21.5 5z",
    eyes: [15.5, 25, 19],
  },
  tablet: {
    d: "M15 3.5h10a7 7 0 017 7v19a7 7 0 01-7 7H15a7 7 0 01-7-7v-19a7 7 0 017-7z",
    eyes: [15.6, 24.4, 16.5],
  },
  wedge: {
    d: "M17.1 6.7a3.4 3.4 0 015.8 0l12.6 21.8A3.4 3.4 0 0132.6 33.6H7.4a3.4 3.4 0 01-2.9-5.1z",
    eyes: [16, 24, 24],
  },
};

export const AVATAR_SHAPES = Object.keys(SHAPES);

type BotLike = { name: string; avatar_shape?: string | null; avatar_color?: string | null; is_coordinator?: boolean | null };

export function isKiwi(bot: BotLike | null | undefined) {
  return !!bot && (bot.is_coordinator === true || bot.name.toLowerCase() === "kiwi");
}

export function BotAvatar({ bot, size = 24, className = "" }: { bot: BotLike; size?: number; className?: string }) {
  if (isKiwi(bot)) return <KiwiBlob size={size} className={className} title={bot.name} interactive={false} />;
  const shape = SHAPES[bot.avatar_shape ?? ""] ?? SHAPES.blob;
  const color = AVATAR_COLORS[bot.avatar_color ?? ""] ?? AVATAR_COLORS.blue;
  const [lx, rx, ey] = shape.eyes;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={`shrink-0 ${className}`} role="img" aria-label={bot.name}>
      <path d={shape.d} fill={color} />
      <ellipse cx={lx} cy={ey} rx="2.3" ry="3" fill="#fff" />
      <ellipse cx={rx} cy={ey} rx="2.3" ry="3" fill="#fff" />
    </svg>
  );
}

/** Avatar for actions you made yourself. */
export function YouAvatar({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={`shrink-0 ${className}`} role="img" aria-label="You">
      <circle cx="20" cy="20" r="17" fill="#eeeeee" />
      <circle cx="20" cy="16" r="5.5" fill="#777777" />
      <path d="M10.5 30.5c1.8-4.6 5.3-7 9.5-7s7.7 2.4 9.5 7" fill="#777777" />
    </svg>
  );
}
