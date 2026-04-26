export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 md:px-8">
      <section className="mx-auto max-w-6xl animate-pulse">
        <div className="h-5 w-40 rounded-full bg-slate-200" />
        <div className="mt-5 h-6 w-24 rounded-full bg-slate-200" />
        <div className="mt-3 h-12 w-80 max-w-full rounded-2xl bg-slate-200" />
        <div className="mt-4 h-5 w-[32rem] max-w-full rounded-full bg-slate-200" />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="h-6 w-40 rounded-full bg-slate-200" />
            <div className="mt-6 h-36 rounded-3xl bg-slate-200" />
            <div className="mt-6 space-y-3">
              <div className="h-20 rounded-2xl bg-slate-200" />
              <div className="h-20 rounded-2xl bg-slate-200" />
              <div className="h-20 rounded-2xl bg-slate-200" />
            </div>
          </div>

          <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="h-6 w-48 rounded-full bg-slate-200" />
            <div className="mt-3 h-5 w-72 max-w-full rounded-full bg-slate-200" />
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="h-14 rounded-2xl bg-slate-200" />
              <div className="h-14 rounded-2xl bg-slate-200" />
            </div>
            <div className="mt-5 h-28 rounded-2xl bg-slate-200" />
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="h-14 rounded-2xl bg-slate-200" />
              <div className="h-14 rounded-2xl bg-slate-200" />
            </div>
            <div className="mt-5 h-32 rounded-2xl bg-slate-200" />
            <div className="mt-5 h-24 rounded-3xl bg-slate-200" />
          </div>
        </div>
      </section>
    </main>
  );
}
