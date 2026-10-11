// Static shell shown while the session and data stream in.

export function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1168px]" aria-busy="true" aria-label="Loading dashboard">
      <div className="px-4 pt-[max(18px,env(safe-area-inset-top))] sm:px-6 sm:pt-8">
        <div className="skeleton h-[19px] w-[128px] rounded-full" />
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
  );
}
