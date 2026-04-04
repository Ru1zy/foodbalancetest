import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();

  // Delete the auth_token cookie
  cookieStore.delete("auth_token");

  // Return success response
  return NextResponse.json({ success: true });
}