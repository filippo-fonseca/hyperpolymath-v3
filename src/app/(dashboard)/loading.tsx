import { DashboardSkeleton } from "@/components/dashboard/skeleton";

// Instant fallback while navigating to the dashboard (after sign-in, or from
// the 404 and error pages). The page streams its own data behind the same skeleton.
export default function Loading() {
  return <DashboardSkeleton />;
}
