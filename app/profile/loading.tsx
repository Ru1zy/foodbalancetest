export default function ProfileLoading() {
  return (
    <main className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
        {/* User Card Skeleton */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="space-y-2">
                <div className="h-6 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-32 rounded-md bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>

        {/* Balances Section Skeleton */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8">
          <div className="h-5 w-44 rounded-md bg-slate-200 dark:bg-slate-800 mb-6" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950 p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="h-8 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Orders History Skeleton */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="h-5 w-36 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
          </div>

          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-24 rounded-md bg-slate-200 dark:bg-slate-800" />
                    <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
                  </div>
                  <div className="h-6 w-20 rounded-md bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="h-16 w-full rounded-xl bg-slate-100 dark:bg-slate-950" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
