import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { AUTH_TOKEN_MAX_AGE, createAuthToken } from "@/lib/auth-token";
import { buildGooglePlaceholderPhone, getGoogleUserFromCode } from "@/lib/google-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?error=google_oauth_${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", request.url));
  }

  try {
    // Exchange code for user info
    const googleUser = await getGoogleUserFromCode(code);

    if (!googleUser.email || !googleUser.sub) {
      return NextResponse.redirect(new URL("/?error=invalid_google_user", request.url));
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
    const redirectUrl = new URL(redirectPath, request.url);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    return NextResponse.redirect(new URL("/?error=google_auth_failed", request.url));
  }
}
