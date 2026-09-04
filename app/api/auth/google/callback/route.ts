import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { AUTH_TOKEN_MAX_AGE, createAuthToken } from "@/lib/auth-token";
import { 
  buildGooglePlaceholderPhone, 
  getGoogleUserFromCode, 
  getGoogleRedirectUri 
} from "@/lib/google-auth";
import { createPublicRedirectUrl } from "@/lib/site-config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const redirectUri = getGoogleRedirectUri(request);
  const redirectTo = (path: string) => createPublicRedirectUrl(path, request);

  if (error) {
    const errorUrl = redirectTo("/");
    errorUrl.searchParams.set("error", `google_oauth_${error}`);
    return NextResponse.redirect(errorUrl);
  }

  if (!code) {
    return NextResponse.redirect(redirectTo("/?error=missing_code"));
  }

  try {
    // Exchange code for user info
    const googleUser = await getGoogleUserFromCode(code, redirectUri);

    if (!googleUser.email || !googleUser.sub) {
      return NextResponse.redirect(redirectTo("/?error=invalid_google_user"));
    }

    // Upsert user: find by googleId OR email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleUser.sub },
          { email: googleUser.email },
        ],
      },
    });

    if (user) {
      // Update existing user with Google data
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name || user.name,
          avatarUrl: googleUser.picture || user.avatarUrl,
        },
      });
    } else {
      // Create new user with Google placeholder phone
      user = await prisma.user.create({
        data: {
          googleId: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name || "Google User",
          phone: buildGooglePlaceholderPhone(googleUser.sub),
          avatarUrl: googleUser.picture,
        },
      });
    }

    // Generate session token using existing auth logic
    const token = await createAuthToken(user.id);
    const cookieStore = await cookies();

    cookieStore.set("auth_token", token, {
      httpOnly: true,
      maxAge: AUTH_TOKEN_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    // Redirect based on phone status
    const redirectPath = user.phone.startsWith("google_") ? "/onboarding" : "/profile";
    const redirectUrl = redirectTo(redirectPath);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    return NextResponse.redirect(redirectTo("/?error=google_auth_failed"));
  }
}
