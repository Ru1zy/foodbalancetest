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
