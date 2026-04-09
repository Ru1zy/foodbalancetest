export default function BroadcastPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Розсилка (Мегафон)</h1>
          <p className="mt-2 text-sm text-gray-600">
            Надішліть повідомлення всім користувачам через Telegram
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <form className="space-y-6">
            <div>
              <label htmlFor="message" className="block text-sm font-semibold text-gray-900">
                Текст повідомлення
              </label>
              <textarea
                id="message"
                rows={6}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Введіть текст повідомлення для розсилки..."
                disabled
              />
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-6">
              <p className="text-sm text-gray-500">
                Функціонал розсилки буде додано пізніше
              </p>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-xl bg-gray-200 px-6 py-3 text-sm font-semibold text-gray-400"
              >
                Надіслати всім
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
