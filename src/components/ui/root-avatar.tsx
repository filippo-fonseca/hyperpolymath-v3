"use client";

import { useDashboard } from "@/components/dashboard/context";
import { ProfileAvatar } from "./bot-avatar";

/**
 * The signed-in person's avatar where they sit at the root of something,
 * like the areas tree: their uploaded photo, else initials, else "You".
 */
export function RootAvatar({ size = 56, className = "" }: { size?: number; className?: string }) {
  const { data } = useDashboard();
  return <ProfileAvatar profile={data.profile} size={size} className={className} />;
}

/** The name shown under it. */
export function useRootName() {
  return useDashboard().data.profile.display_name?.trim() || "You";
}
