import { YouAvatar } from "./bot-avatar";

/**
 * The signed-in person's avatar where they sit at the root of something,
 * like the areas tree. The generic "You" glyph for now; this is the one
 * place to swap in an uploaded profile photo later.
 */
export function RootAvatar({ size = 56, className = "" }: { size?: number; className?: string }) {
  return <YouAvatar size={size} className={className} />;
}
