export default function AdminLoading() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
        {/* Admin Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-60 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-40 rounded-md bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-10 w-36 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>

        {/* Quick Stats / Filter Bar Skeleton */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-7 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-850 p-2">
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <div key={row} className="flex items-center justify-between p-4 gap-4">
                <div className="flex items-center gap-3 w-1/4">
                  <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="space-y-1 w-full">
                    <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="h-4 w-1/5 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-8 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
