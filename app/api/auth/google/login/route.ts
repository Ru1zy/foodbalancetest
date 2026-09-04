import { NextResponse } from "next/server";
import { getGoogleRedirectUri } from "@/lib/google-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = getGoogleRedirectUri(request);

  if (!clientId) {
    return NextResponse.json(
      { message: "Google OAuth is not configured: GOOGLE_CLIENT_ID is missing", ok: false },
      { status: 500 }
    );
  }

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("access_type", "online");
  googleAuthUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(googleAuthUrl.toString());
}
