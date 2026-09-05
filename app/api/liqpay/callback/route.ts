import { NextResponse } from "next/server";

// ⚠️ DISABLED: LiqPay is obsolete and replaced by Monobank Plata.
// This callback had no cryptographic signature verification and is permanently disabled.
export async function POST() {
  return NextResponse.json(
    { error: "LiqPay callback is disabled. Monobank Plata is used." },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
