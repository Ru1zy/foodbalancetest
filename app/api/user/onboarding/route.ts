import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth-token";
import { normalizePhone } from "@/lib/phone-utils";
import { generateOTPCode, sendTelegramOTP } from "@/lib/telegram-otp";

export const runtime = "nodejs";

type OnboardingRequest = {
  phone: string;
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

    const userId = await verifyAuthToken(authToken);

    if (!userId) {
      return NextResponse.json(
        { message: "Invalid session", ok: false },
        { status: 401 }
      );
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { message: "User not found", ok: false },
        { status: 404 }
      );
    }

    // Parse request body
    const body = (await request.json()) as OnboardingRequest;
    const normalizedPhone = normalizePhone(body.phone);

    if (!normalizedPhone || normalizedPhone.length < 10) {
      return NextResponse.json(
        { message: "Неправильний формат телефону", ok: false },
        { status: 400 }
      );
    }

    // Check if phone already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true, chatId: true, name: true },
    });

    // SCENARIO A: Phone is free
    if (!existingUser) {
      await prisma.user.update({
        where: { id: currentUser.id },
        data: { phone: normalizedPhone },
      });

      return NextResponse.json({
        success: true,
        ok: true,
      });
    }

    // SCENARIO B: Phone exists
    // Check if it's the same user (shouldn't happen, but handle it)
    if (existingUser.id === currentUser.id) {
      return NextResponse.json({
        success: true,
        ok: true,
      });
    }

    // Check if existing user has Telegram chatId
    if (!existingUser.chatId) {
      return NextResponse.json(
        {
          message: "Цей номер вже зареєстрований, але не прив'язаний до Telegram. Зверніться до підтримки.",
          ok: false,
        },
        { status: 400 }
      );
    }

    // Rate limit OTP requests to prevent Telegram spam
    const { otpRequestLimiter, otpGuessLimiter } = await import("@/lib/rate-limit");

    if (otpGuessLimiter.isBlocked(currentUser.id) || otpGuessLimiter.isBlocked(normalizedPhone)) {
      const remaining = Math.max(
        otpGuessLimiter.getRemainingCooldownSeconds(currentUser.id),
        otpGuessLimiter.getRemainingCooldownSeconds(normalizedPhone)
      );
      const mins = Math.max(1, Math.ceil(remaining / 60));
      return NextResponse.json(
        {
          message: `Забагато невірних спроб введення коду. Зачекайте ${mins} хв перед новою спробою.`,
          ok: false,
        },
        { status: 429 }
      );
    }

    if (!otpRequestLimiter.check(normalizedPhone) || !otpRequestLimiter.check(currentUser.id)) {
      return NextResponse.json(
        {
          message: "Занадто багато запитів коду. Будь ласка, зачекайте 1 хвилину.",
          ok: false,
        },
        { status: 429 }
      );
    }

    // Generate OTP code
    const code = generateOTPCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP to database bound to the requesting user
    await prisma.mergeToken.upsert({
      where: { phone: normalizedPhone },
      create: {
        phone: normalizedPhone,
        code,
        targetUserId: currentUser.id,
        attempts: 0,
        expiresAt,
      },
      update: {
        code,
        targetUserId: currentUser.id,
        attempts: 0,
        expiresAt,
      },
    });

    // Send OTP via Telegram
    const sent = await sendTelegramOTP(existingUser.chatId, code);

    if (!sent) {
      return NextResponse.json(
        {
          message: "Не вдалося надіслати код підтвердження. Спробуйте пізніше.",
          ok: false,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      requireOtp: true,
      ok: true,
      message: `Код підтвердження надіслано в Telegram на акаунт ${existingUser.name}`,
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { message: "Internal server error", ok: false },
      { status: 500 }
    );
  }
}
