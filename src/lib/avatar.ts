// Avatar upload rules, shared by the server (which enforces them) and the
// Settings form (which checks early so a too-big photo fails fast).

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type AvatarType = (typeof AVATAR_TYPES)[number];

const EXT: Record<AvatarType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export const avatarExtension = (type: AvatarType) => EXT[type];

/**
 * The real image type from the file's first bytes, or null when it isn't one
 * we accept. The browser's declared type is easy to fake, so we trust bytes.
 */
export function sniffImageType(bytes: Uint8Array): AvatarType | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, j) => bytes[i + j] === b);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** Initials for a fallback avatar: "Ada Lovelace" -> "AL", "ada@x.com" -> "A". */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  if (!words.length) return "";
  const letters = words.length === 1 ? words[0].slice(0, 1) : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}
