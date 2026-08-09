"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import {
  ensureMonthlySpreadsheet,
  getUpcomingMonthKey,
} from "@/lib/google-drive";

const SETTINGS_PATH = "/admin/settings/sheets";

export type ProvisionUpcomingSheetActionResult =
  | {
      ok: true;
      monthKey: string;
      spreadsheetUrl: string;
      created: boolean;
      recovered: boolean;
    }
  | { ok: false; error: string };

export async function provisionUpcomingMonthlySheet(): Promise<ProvisionUpcomingSheetActionResult> {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return { ok: false, error: "Доступ заборонено." };
  }

  const result = await ensureMonthlySpreadsheet(getUpcomingMonthKey());
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(SETTINGS_PATH);
  return {
    ok: true,
    monthKey: result.monthKey,
    spreadsheetUrl: result.spreadsheetUrl,
    created: result.created,
    recovered: result.recovered,
  };
}
