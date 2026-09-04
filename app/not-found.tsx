import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-grow items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 text-4xl shadow-inner border border-emerald-100 dark:border-emerald-900/50">
          🥗
        </div>
        <p className="text-sm font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          Помилка 404
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl font-comfortaa">
          Сторінку не знайдено
        </h1>
        <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          Схоже, цієї сторінки не існує або вона була переміщена. Перейдіть до меню, щоб обрати свій раціон.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition active:scale-95"
          >
            До меню страв
          </Link>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95"
          >
            Мій профіль
          </Link>
        </div>
      </div>
    </main>
  );
}
