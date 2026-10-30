import Link from "next/link";
import SupportWidget from "@/components/SupportWidget";

type AuthErrorPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <section className="relative flex flex-1 items-center justify-center px-4 py-16 sm:py-24">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:p-10">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-2xl dark:bg-rose-950/50" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
          Не вдалося увійти
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Виникла помилка під час входу. Напишіть нам, ми розберемося.
        </p>
        {errorCode && (
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Код помилки: <code className="font-mono">{errorCode}</code>
          </p>
        )}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/?auth=required"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
          >
            Спробувати ще раз
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            На головну
          </Link>
        </div>
        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
          Або скористайтеся кнопкою підтримки, щоб повідомити адміністратора.
        </p>
      </div>
      <SupportWidget initialMessage={errorCode ? `Помилка входу. Код: ${errorCode}` : "Помилка входу"} />
    </section>
  );
}
