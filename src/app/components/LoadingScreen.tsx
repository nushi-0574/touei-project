function SkeletonBlock({ className }: { className: string }) {
  return (
    <div aria-hidden="true" className={`rounded bg-slate-200 ${className}`} />
  );
}

export function ContentSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="animate-pulse space-y-4 py-4">
      <span className="sr-only">ページを読み込んでいます</span>
      <div className="rounded border border-slate-200 bg-white p-4 sm:p-6">
        <SkeletonBlock className="mb-5 h-5 w-1/3" />
        <div className="space-y-4">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
              <SkeletonBlock className="h-4 w-2/5" />
              <SkeletonBlock className="h-3 w-full" />
              <SkeletonBlock className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoadingScreen({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <main
      role={ariaHidden ? undefined : 'status'}
      aria-live={ariaHidden ? undefined : 'polite'}
      aria-busy={ariaHidden ? undefined : true}
      aria-hidden={ariaHidden}
      className="fixed inset-0 z-[100] min-h-screen overflow-auto bg-slate-100 px-4 py-4 text-slate-800 sm:px-6"
    >
      <svg
        aria-hidden="true"
        className="loading-perimeter pointer-events-none fixed inset-0 z-[101] h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="loading-perimeter-gradient">
            <stop offset="0%" stopColor="#0046ff" stopOpacity="0" />
            <stop offset="65%" stopColor="#0046ff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="calc(100% - 4px)"
          height="calc(100% - 4px)"
          rx="14"
          pathLength="100"
          fill="none"
          stroke="url(#loading-perimeter-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="22 78"
        />
      </svg>
      <div className="mx-auto max-w-7xl animate-pulse">
        <div aria-hidden="true" className="mb-8 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="h-8 w-28" />
        </div>
        <div className="mb-6 space-y-3">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-8 w-2/5 max-w-md" />
          <SkeletonBlock className="h-4 w-3/5 max-w-2xl" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <div className="h-56 rounded border border-slate-200 bg-white p-4">
              <SkeletonBlock className="h-full" />
            </div>
            <div className="h-40 rounded border border-slate-200 bg-white p-4">
              <SkeletonBlock className="h-full" />
            </div>
          </div>
          <div className="space-y-5">
            <div className="h-40 rounded border border-slate-200 bg-white p-4">
              <SkeletonBlock className="h-full" />
            </div>
            <div className="h-56 rounded border border-slate-200 bg-white p-4">
              <SkeletonBlock className="h-full" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
