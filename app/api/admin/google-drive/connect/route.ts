import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { buildGoogleDriveAuthorizationUrl } from "@/lib/google-drive";

export const runtime = "nodejs";

const STATE_COOKIE = "foodbalance_drive_oauth_state";

export async function GET() {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const state = randomBytes(32).toString("base64url");
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/api/admin/google-drive",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.redirect(buildGoogleDriveAuthorizationUrl(state));
  } catch (error) {
    console.error(
      "Failed to start Google Drive OAuth:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Google Drive OAuth is not configured" },
      { status: 503 },
    );
  }
}
