import { NextResponse } from "next/server";
import { processAllOutboxJobs } from "@/lib/outbox";

// This endpoint can be called by Vercel Cron or any other scheduler
// Example: GET /api/cron/process-outbox
export async function GET(request: Request) {
  // Optional: protect via CRON_SECRET if configured
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    request.headers.get("x-vercel-cron") !== process.env.CRON_SECRET // Vercel fallback
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
