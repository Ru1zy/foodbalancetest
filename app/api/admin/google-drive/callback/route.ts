import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { connectGoogleDriveFromAuthorizationCode } from "@/lib/google-drive";

export const runtime = "nodejs";

const STATE_COOKIE = "foodbalance_drive_oauth_state";

import { getPublicAppUrl } from "@/lib/site-config";

function settingsUrl(params: Record<string, string>): URL {
  let origin: string;
  try {
    origin = process.env.GOOGLE_DRIVE_REDIRECT_URI
      ? new URL(process.env.GOOGLE_DRIVE_REDIRECT_URI).origin
      : getPublicAppUrl();
  } catch {
    origin = getPublicAppUrl();
  }
  const url = new URL("/admin/settings/sheets", origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function stateMatches(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export async function GET(request: Request) {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!stateMatches(requestUrl.searchParams.get("state"), expectedState)) {
    return NextResponse.redirect(settingsUrl({ drive_error: "invalid_state" }));
  }

  if (requestUrl.searchParams.get("error")) {
    return NextResponse.redirect(settingsUrl({ drive_error: "access_denied" }));
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(settingsUrl({ drive_error: "missing_code" }));
  }

  let redirectParams: Record<string, string>;
  try {
    const result = await connectGoogleDriveFromAuthorizationCode(code);
    redirectParams = { drive: "connected" };
    if (!result.upcomingProvision.ok) {
      redirectParams.drive_warning = result.upcomingProvision.code;
    }
  } catch (error) {
    console.error(
      "Google Drive OAuth callback failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    redirectParams = { drive_error: "connection_failed" };
  }

  return NextResponse.redirect(settingsUrl(redirectParams));
}
