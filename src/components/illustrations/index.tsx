// Notion-style spot illustrations starring Kiwi: monochrome line art on a
// 200x200 canvas with at most one small accent. Every scene takes the same
// props so screens can swap them freely. The shared kit is in kiwi-figure.tsx.

export type { IllustrationProps } from "./kiwi-figure";

/** Login: Kiwi holding a key. KiwiMail: magic link sent. KiwiLost: 404. */
export { KiwiWithKey, KiwiMail, KiwiLost } from "./scenes-arrival";
/** Error boundary, offline, and a widget waiting for its first publish. */
export { KiwiFixing, KiwiOffline, KiwiWaiting } from "./scenes-system";
/** Nothing due (asleep), no captures (reading), no habits (watering). */
export { KiwiSleeping, KiwiReading, KiwiWatering } from "./scenes-quiet";
/** Calendar empty (stargazing), no projects (blocks), teammates (friends). */
export { KiwiStargazing, KiwiBuilding, KiwiTeam } from "./scenes-together";
