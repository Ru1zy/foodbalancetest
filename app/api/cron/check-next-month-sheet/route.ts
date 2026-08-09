import { NextResponse } from "next/server";
import {
  ensureMonthlySpreadsheet,
  getUpcomingMonthKey,
} from "@/lib/google-drive";
import { sendAdminAlert } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * Ensure that the upcoming month's delivery workbook exists. Drive OAuth owns
 * the folder/template and creates the workbook automatically. Checkout stays
 * operational if this fails; the admin receives a manual-recovery alert.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron endpoint is not configured" },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthKey = getUpcomingMonthKey();
  try {
    const result = await ensureMonthlySpreadsheet(monthKey);
    if (result.ok) {
      return NextResponse.json({
        ok: true,
        monthKey,
        configured: true,
        created: result.created,
        recovered: result.recovered,
        timestamp: new Date().toISOString(),
      });
    }

    const adminUrl = process.env.APP_BASE_URL
      ? `${process.env.APP_BASE_URL.replace(/\/$/, "")}/admin/settings/sheets`
      : null;
    const message = [
      "🔴🔴🔴 <b>УВАГА: НЕ ВДАЛОСЯ ПІДГОТУВАТИ ТАБЛИЦЮ!</b>",
      "",
      `Місяць: <b>${monthKey}</b>`,
      `Причина: ${result.error}`,
      "",
      "Поки проблему не виправлено, нові замовлення будуть позначені для ручного внесення.",
      adminUrl
        ? `➡️ Налаштування: ${adminUrl}`
        : "➡️ Відкрийте налаштування таблиць в адмін-панелі.",
    ].join("\n");
    const alertsDelivered = await sendAdminAlert(message);

    return NextResponse.json(
      {
        ok: false,
        monthKey,
        configured: false,
        code: result.code,
        alertsDelivered,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  } catch (error) {
    console.error(
      "Cron job check-next-month-sheet failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { ok: false, error: "Monthly sheet check failed" },
      { status: 500 },
    );
  }
}
