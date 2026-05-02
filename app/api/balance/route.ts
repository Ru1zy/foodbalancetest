import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ availableDays: 0 });
    }

    let userId: string;
    try {
      const payload = await verifyAuthToken(token);
      if (!payload) {
        return NextResponse.json({ availableDays: 0 });
      }
      userId = payload;
    } catch {
      return NextResponse.json({ availableDays: 0 });
    }

    const searchParams = request.nextUrl.searchParams;
    const packageId = searchParams.get("packageId");

    if (!packageId) {
      return NextResponse.json({ error: "PackageId is required" }, { status: 400 });
    }

    const balance = await prisma.userBalance.findUnique({
      where: {
        userId_packageId: {
          userId,
          packageId,
        },
      },
    });

    if (!balance) {
      return NextResponse.json({ availableDays: 0 });
    }

    const availableDays = Math.max(0, balance.totalDays - balance.usedDays);

    return NextResponse.json({ availableDays });
  } catch (error) {
    console.error("Fetch balance error:", error);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}
