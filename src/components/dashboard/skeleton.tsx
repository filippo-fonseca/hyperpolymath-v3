import { KiwiLoader } from "@/components/ui/kiwi-loader";

// Static shell shown while the session and data stream in. Mirrors the
// header and the widget grid so nothing jumps when the real thing lands.

export function DashboardSkeleton() {
  return (
    <div className="relative mx-auto w-full max-w-[1168px]" aria-busy="true">
      <div aria-hidden>
        <div className="px-4 pt-[max(18px,env(safe-area-inset-top))] sm:px-6 sm:pt-8">
          <div className="flex items-start justify-between">
            <div className="skeleton h-[19px] w-[128px] rounded-full" />
            <div className="flex gap-1">
              <div className="skeleton h-8 w-12 rounded-full" />
              <div className="skeleton h-9 w-9 rounded-full" />
            </div>
          </div>
          <div className="skeleton mt-8 h-3.5 w-36 rounded-full" />
          <div className="skeleton mt-2.5 h-7 w-52 rounded-full" />
        </div>
        <div className="widget-page mt-6 px-4 pt-3 sm:px-6">
          <div className="widget-grid">
            {["l", "m", "m", "m", "m"].map((s, i) => (
              <div key={i} className={`size-${s} skeleton rounded-[22px]`} />
            ))}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[38vh] flex justify-center">
        <span className="rounded-full bg-surface/85 p-2 shadow-ring backdrop-blur">
          <KiwiLoader size={40} label="Loading your dashboard" />
        </span>
      </div>
    </div>
  );
}
