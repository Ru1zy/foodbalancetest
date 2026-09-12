"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import {
  validateSheetConfigInput,
  type SheetConfigInput,
} from "@/lib/sheet-config-validation";

export type SheetConfigActionResult =
  | { ok: true }
  | { ok: false; error: string };

const SETTINGS_PATH = "/admin/settings/sheets";

/** Lists every monthly spreadsheet mapping, newest month key first. */
export async function getAllSheetConfigs() {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return [];
  }

  try {
    return await prisma.sheetConfig.findMany({
      orderBy: { monthKey: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch sheet configs:", error);
    return [];
  }
}

/** Creates a new `SheetConfig` row after enforcing admin auth + validation. */
export async function createSheetConfig(
  input: SheetConfigInput
): Promise<SheetConfigActionResult> {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return { ok: false, error: "Доступ заборонено: потрібні права адміністратора." };
  }

  const validation = validateSheetConfigInput(input);
  if (!validation.ok) {
    return validation;
  }

  try {
    await prisma.sheetConfig.create({ data: validation.value });
    revalidatePath(SETTINGS_PATH);
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: `Конфігурація для місяця ${validation.value.monthKey} вже існує.`,
      };
    }
    console.error("Failed to create sheet config:", error);
    return { ok: false, error: "Не вдалося створити конфігурацію." };
  }
}

/** Updates an existing `SheetConfig` row. */
export async function updateSheetConfig(
  id: string,
  input: SheetConfigInput
): Promise<SheetConfigActionResult> {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return { ok: false, error: "Доступ заборонено: потрібні права адміністратора." };
  }

  const validation = validateSheetConfigInput(input);
  if (!validation.ok) {
    return validation;
  }

  try {
    await prisma.sheetConfig.update({
      where: { id },
      data: validation.value,
    });
    revalidatePath(SETTINGS_PATH);
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: `Конфігурація для місяця ${validation.value.monthKey} вже існує.`,
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { ok: false, error: "Конфігурацію не знайдено." };
    }
    console.error("Failed to update sheet config:", error);
    return { ok: false, error: "Не вдалося оновити конфігурацію." };
  }
}

/** Deletes a `SheetConfig` row by id. */
export async function deleteSheetConfig(
  id: string
): Promise<SheetConfigActionResult> {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return { ok: false, error: "Доступ заборонено: потрібні права адміністратора." };
  }

  try {
    await prisma.sheetConfig.delete({ where: { id } });
    revalidatePath(SETTINGS_PATH);
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { ok: false, error: "Конфігурацію не знайдено." };
    }
    console.error("Failed to delete sheet config:", error);
    return { ok: false, error: "Не вдалося видалити конфігурацію." };
  }
}

/** Sorts tabs in a monthly spreadsheet in chronological order (01.MM ... 31.MM, _Template). */
export async function sortSheetTabsAction(
  spreadsheetId: string
): Promise<{ ok: boolean; message: string }> {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return { ok: false, message: "Доступ заборонено: потрібні права адміністратора." };
  }

  try {
    const { sortMonthlySheetTabs } = await import("@/lib/monthlySheets");
    const success = await sortMonthlySheetTabs(spreadsheetId);
    if (!success) {
      return { ok: false, message: "Не вдалося відсортувати вкладки. Перевірте доступ сервісного акаунта." };
    }
    revalidatePath(SETTINGS_PATH);
    return { ok: true, message: "Вкладки успішно відсортовано за датою (01.MM ... 31.MM)!" };
  } catch (error) {
    console.error("Failed to sort sheet tabs:", error);
    return { ok: false, message: "Помилка при сортуванні вкладок." };
  }
}

/** Sorts tabs across all configured monthly spreadsheets. */
export async function sortAllSheetsTabsAction(): Promise<{ ok: boolean; message: string }> {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return { ok: false, message: "Доступ заборонено: потрібні права адміністратора." };
  }

  try {
    const configs = await prisma.sheetConfig.findMany();
    if (configs.length === 0) {
      return { ok: false, message: "Не знайдено жодної таблиці для сортування." };
    }

    const { sortMonthlySheetTabs } = await import("@/lib/monthlySheets");
    let sortedCount = 0;
    for (const cfg of configs) {
      if (cfg.spreadsheetId) {
        const ok = await sortMonthlySheetTabs(cfg.spreadsheetId);
        if (ok) sortedCount++;
      }
    }

    revalidatePath(SETTINGS_PATH);
    return { ok: true, message: `Успішно відсортовано вкладки у ${sortedCount} з ${configs.length} таблиць!` };
  } catch (error) {
    console.error("Failed to sort all sheets tabs:", error);
    return { ok: false, message: "Помилка при сортуванні таблиць." };
  }
}
