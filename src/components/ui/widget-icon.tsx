import { isImageIcon } from "@/lib/widgets";

/** A widget's icon: an image (a favicon or any https image) or an emoji. */
export function WidgetIcon({ icon, size = 16, className = "" }: { icon: string | null | undefined; size?: number; className?: string }) {
  if (!icon) return null;
  if (isImageIcon(icon)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote icons, tiny and not worth the image optimizer
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`shrink-0 rounded-[4px] object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`} style={{ width: size, height: size, fontSize: size * 0.9 }} aria-hidden>
      {icon}
    </span>
  );
}
