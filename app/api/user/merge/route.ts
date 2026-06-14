import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { verifyAuthToken, createAuthToken, AUTH_TOKEN_MAX_AGE } from "@/lib/auth-token";
import { normalizePhone } from "@/lib/phone-utils";

export const runtime = "nodejs";

type MergeRequest = {
  phone: string;
  code: string;
};

export async function POST(request: Request) {
  try {
    // Get current user from session
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token")?.value;

    if (!authToken) {
      return NextResponse.json(
        { message: "Unauthorized", ok: false },
        { status: 401 }
      );
    }

    const currentUserId = await verifyAuthToken(authToken);

    if (!currentUserId) {
      return NextResponse.json(
        { message: "Invalid session", ok: false },
        { status: 401 }
      );
    }

    // Parse request body
    const body = (await request.json()) as MergeRequest;
    const normalizedPhone = normalizePhone(body.phone);
    const code = body.code?.trim();

    if (!normalizedPhone || !code) {
      return NextResponse.json(
        { message: "Невірний формат даних", ok: false },
        { status: 400 }
      );
    }

    // Validate OTP
    const mergeToken = await prisma.mergeToken.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!mergeToken) {
      return NextResponse.json(
        { message: "Код підтвердження не знайдено", ok: false },
        { status: 400 }
      );
    }

    // Check if expired
    if (mergeToken.expiresAt < new Date()) {
      await prisma.mergeToken.delete({
        where: { phone: normalizedPhone },
      });

      return NextResponse.json(
        { message: "Термін дії коду вичерпано. Спробуйте ще раз.", ok: false },
        { status: 400 }
      );
    }

    // Check if code matches
    if (mergeToken.code !== code) {
      return NextResponse.json(
        { message: "Невірний код підтвердження", ok: false },
        { status: 400 }
      );
    }

    // Get current user (Google user with placeholder phone)
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        email: true,
        googleId: true,
        avatarUrl: true,
        phone: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { message: "User not found", ok: false },
        { status: 404 }
      );
    }

    // Get old user (Telegram user with real phone)
    const oldUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true, chatId: true },
    });

    if (!oldUser) {
      return NextResponse.json(
        { message: "Користувача з цим номером не знайдено", ok: false },
        { status: 404 }
      );
    }

    // Perform account merge in transaction
    // CRITICAL: Delete temp user FIRST to free up unique constraints (email, googleId)
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Transfer orders from current user to old user (if any)
      await tx.order.updateMany({
        where: { userId: currentUser.id },
        data: { userId: oldUser.id },
      });

      // Transfer balances from current user to old user (if any)
      const currentBalances = await tx.userBalance.findMany({
        where: { userId: currentUser.id },
      });

      for (const balance of currentBalances) {
        const existingBalance = await tx.userBalance.findUnique({
          where: {
            userId_packageId: {
              userId: oldUser.id,
              packageId: balance.packageId,
            },
          },
        });

        if (existingBalance) {
          // Merge balances
          await tx.userBalance.update({
            where: {
              userId_packageId: {
                userId: oldUser.id,
                packageId: balance.packageId,
              },
            },
            data: {
              totalDays: existingBalance.totalDays + balance.totalDays,
              usedDays: existingBalance.usedDays + balance.usedDays,
            },
          });
        } else {
          // Transfer balance
          await tx.userBalance.update({
            where: { id: balance.id },
            data: { userId: oldUser.id },
          });
        }
      }

      // Step 1: DELETE current user (placeholder) to free unique constraints
      await tx.user.delete({
        where: { id: currentUser.id },
      });

      // Step 2: UPDATE old user with Google data (now constraints are free)
      await tx.user.update({
        where: { id: oldUser.id },
        data: {
          email: currentUser.email,
          googleId: currentUser.googleId,
          avatarUrl: currentUser.avatarUrl,
        },
      });

      // Step 3: Delete OTP token
      await tx.mergeToken.delete({
        where: { phone: normalizedPhone },
      });
    });

    // Create new session token for the merged user
    const newToken = await createAuthToken(oldUser.id);

    // Update cookie to point to old user
    cookieStore.set("auth_token", newToken, {
      httpOnly: true,
      maxAge: AUTH_TOKEN_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({
      success: true,
      ok: true,
      message: "Аккаунти успішно об'єднано",
    });
  } catch (error) {
    console.error("Merge error:", error);
    return NextResponse.json(
      { message: "Internal server error", ok: false },
      { status: 500 }
    );
  }
}
