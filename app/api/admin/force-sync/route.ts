import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { ensureMonthlySpreadsheet } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const monthKey = request.nextUrl.searchParams.get("month") || "08.2026";
  try {
    const result = await ensureMonthlySpreadsheet(monthKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Force sync failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
