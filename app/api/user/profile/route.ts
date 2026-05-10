import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth-token";

export const runtime = "nodejs";

export async function GET() {
  try {
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        avatarUrl: true,
        address: true,
        chatId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found", ok: false },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      user,
    });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json(
      { message: "Internal server error", ok: false },
      { status: 500 }
    );
  }
}
