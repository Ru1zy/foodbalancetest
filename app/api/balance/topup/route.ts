import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Необхідна авторизація" }, { status: 401 });
    }

    let userId: string;
    try {
      const payload = await verifyAuthToken(token);
      if (!payload) {
        return NextResponse.json({ error: "Недійсний токен" }, { status: 401 });
      }
      userId = payload;
    } catch {
      return NextResponse.json({ error: "Недійсний токен" }, { status: 401 });
    }

    const { packageId, duration } = await request.json();

    if (!packageId || typeof duration !== "number" || duration <= 0) {
      return NextResponse.json({ error: "Некоректні дані запиту" }, { status: 400 });
    }

    // Trial period validation: only for new clients (no balance history)
    if (duration === 2) {
      const existingBalance = await prisma.userBalance.findFirst({
        where: { userId }
      });
      
      if (existingBalance) {
        return NextResponse.json(
          { error: "Пробний період доступний лише один раз для нових клієнтів." }, 
          { status: 403 }
        );
      }
    }

    const updatedBalance = await prisma.userBalance.upsert({
      where: {
        userId_packageId: {
          userId,
          packageId,
        },
      },
      update: {
        totalDays: {
          increment: duration,
        },
      },
      create: {
        userId,
        packageId,
        totalDays: duration,
        usedDays: 0,
      },
    });

    return NextResponse.json({
      success: true,
      balance: updatedBalance,
    });
  } catch (error) {
    console.error("Balance top-up error:", error);
    return NextResponse.json({ error: "Помилка при поповненні балансу" }, { status: 500 });
  }
}
