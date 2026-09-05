import { NextResponse } from "next/server";
import { processAllOutboxJobs } from "@/lib/outbox";

// This endpoint can be called by Vercel Cron or any other scheduler
// Example: GET /api/cron/process-outbox
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (
    authHeader !== `Bearer ${cronSecret}` &&
    request.headers.get("x-vercel-cron") !== cronSecret
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await processAllOutboxJobs();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Outbox cron job failed:", error);
    return NextResponse.json({ error: "Failed to process outbox" }, { status: 500 });
  }
}
