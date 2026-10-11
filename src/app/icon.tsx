import { monogram } from "@/lib/brand-icon";

export const contentType = "image/png";

export function generateImageMetadata() {
  return [32, 192, 512].map((s) => ({ id: String(s), size: { width: s, height: s }, contentType }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return monogram(size, { rounded: size <= 32 });
}
