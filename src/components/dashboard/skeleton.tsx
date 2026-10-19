import { KiwiLoader } from "@/components/ui/kiwi-loader";

// Static shell shown while the session and data stream in. Mirrors the app
// bar, the greeting with its summary chips, and the widget grid so nothing
// jumps when the real thing lands.

export function DashboardSkeleton() {
  return (
    <div className="relative" aria-busy="true">
      <div aria-hidden>
        <div className="pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex h-14 max-w-[1168px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="skeleton h-[20px] w-[132px] rounded-full" />
            <div className="hidden gap-1.5 md:flex">
              {[64, 64, 84, 70, 80, 76, 76].map((w, i) => (
                <div key={i} className="skeleton h-8 rounded-full max-lg:!w-9" style={{ width: w }} />
              ))}
            </div>
            <div className="flex gap-1">
              <div className="skeleton h-9 w-9 rounded-full sm:w-[118px]" />
              <div className="skeleton h-9 w-12 rounded-full" />
              <div className="skeleton h-9 w-9 rounded-full" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1168px]">
          <div className="px-4 pt-5 sm:px-6 sm:pt-8">
            <div className="skeleton h-3.5 w-36 rounded-full" />
            <div className="skeleton mt-2.5 h-7 w-52 rounded-full" />
            <div className="mt-4 flex gap-2">
              {[132, 168, 120].map((w, i) => (
                <div key={i} className="skeleton h-8 rounded-full" style={{ width: w }} />
              ))}
            </div>
          </div>
          <div className="widget-page mt-3 px-4 pt-3 sm:mt-5 sm:px-6">
            <div className="widget-grid">
              {["l", "l", "m", "m", "m", "m"].map((s, i) => (
                <div key={i} className={`size-${s} skeleton rounded-[22px]`} />
              ))}
            </div>
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
