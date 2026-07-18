export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth-token";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ linked: false });
    const userId = await verifyAuthToken(token);
    if (!userId) return NextResponse.json({ linked: false });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { chatId: true },
    });
    return NextResponse.json({ linked: !!user?.chatId });
  } catch {
    return NextResponse.json({ linked: false });
  }
}