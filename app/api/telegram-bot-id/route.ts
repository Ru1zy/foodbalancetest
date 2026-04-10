import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();

    if (data.ok && data.result.id) {
      return NextResponse.json({ botId: String(data.result.id) });
    }

    return NextResponse.json({ error: "Failed to get bot info" }, { status: 500 });
  } catch (error) {
    console.error("Failed to fetch bot ID:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
