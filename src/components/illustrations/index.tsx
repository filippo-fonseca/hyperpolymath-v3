import { KiwiBlob } from "@/components/ui/kiwi-blob";

// Notion-style spot illustrations starring Kiwi. Every scene takes the same
// props so screens can swap them freely. (Placeholders until the set lands.)

export type IllustrationProps = { size?: number; className?: string; title?: string };

function Placeholder({ size = 160, className = "", title }: IllustrationProps) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }} role="img" aria-label={title}>
      <KiwiBlob size={Math.round(size * 0.5)} interactive={false} />
    </span>
  );
}

/** Login: Kiwi holding a key. */
export const KiwiWithKey = Placeholder;
/** Magic link sent: Kiwi with a letter. */
export const KiwiMail = Placeholder;
/** 404: Kiwi lost with a map. */
export const KiwiLost = Placeholder;
/** Error boundary: Kiwi with a wrench. */
export const KiwiFixing = Placeholder;
/** Offline: Kiwi with an unplugged cord. */
export const KiwiOffline = Placeholder;
/** Nothing due: Kiwi asleep. */
export const KiwiSleeping = Placeholder;
/** No captures: Kiwi reading. */
export const KiwiReading = Placeholder;
/** No habits: Kiwi watering a sprout. */
export const KiwiWatering = Placeholder;
/** Calendar empty or not connected: Kiwi stargazing. */
export const KiwiStargazing = Placeholder;
/** No projects: Kiwi building blocks. */
export const KiwiBuilding = Placeholder;
/** Teammates / Grok Bot setup: Kiwi with a couple of blob friends. */
export const KiwiTeam = Placeholder;
/** Widget waiting for its first publish: Kiwi with an hourglass. */
export const KiwiWaiting = Placeholder;
