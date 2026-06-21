import { NextResponse } from "next/server";
import { getSheetIdForMonth } from "@/lib/monthlySheets";
import { sendAdminAlert } from "@/lib/telegram";
import { kyivTodayParts } from "@/lib/order-logic";

/**
 * PROACTIVE FAILSAFE — Vercel Cron.
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-next-month-sheet",
 *     "schedule": "0 9 25-31 * *"
 *   }]
 * }
 *
 * `25-31` makes Vercel invoke this daily from the 25th to the end of every
 * month (09:00 UTC). It verifies that the GOOGLE_SHEET_ID for the UPCOMING
 * month is configured in `SheetConfig`. If it is missing, it fires a
 * high-priority warning to the admin Telegram chat so the admin sets it up
 * BEFORE the first order of that month arrives — preventing the manual-entry
 * fallback from ever kicking in.
 *
 * Authorization: protected by the optional CRON_SECRET bearer token, same as
 * the archive-orders cron.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Today's Europe/Kyiv calendar date (DST-aware).
    const { year, month } = kyivTodayParts();

    // The upcoming month (wraps December -> January).
    const upcomingMonth = month === 12 ? 1 : month + 1;
    const upcomingYear = month === 12 ? year + 1 : year;
    const monthKey = `${String(upcomingMonth).padStart(2, "0")}.${upcomingYear}`;

    const spreadsheetId = await getSheetIdForMonth(monthKey);

    if (spreadsheetId) {
      return NextResponse.json({
        ok: true,
        monthKey,
        configured: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Missing — raise a high-priority alert to the admin chat(s).
    const message = [
      "🔴🔴🔴 <b>УВАГА: ТАБЛИЦЯ НА НАСТУПНИЙ МІСЯЦЬ НЕ НАЛАШТОВАНА!</b>",
      "",
      `Для місяця <b>${monthKey}</b> ще НЕ задано Google Sheet ID.`,
      "",
      "❗️ Поки таблиця відсутня, замовлення на цей місяць будуть",
      "позначатись як <b>[🔴 ТАБЛИЦА НЕ НАЙДЕНА - ВНЕСТИ ВРУЧНУЮ]</b>",
      "і їх доведеться вносити вручну.",
      "",
      `➡️ Додайте запис у SheetConfig: monthKey = <code>${monthKey}</code>, spreadsheetId = ID нової таблиці.`,
    ].join("\n");

    const delivered = await sendAdminAlert(message);

    return NextResponse.json({
      ok: true,
      monthKey,
      configured: false,
      alertsDelivered: delivered,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job check-next-month-sheet failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
