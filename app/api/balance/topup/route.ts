import { NextResponse } from "next/server";

// ⚠️ DISABLED — DO NOT RE-ENABLE WITHOUT A VERIFIED PAYMENT FLOW.
//
// The previous implementation let any authenticated user grant themselves an
// unlimited balance by POSTing `{ packageId, duration }` directly (no payment
// verification, no `duration` cap, no `packageId` allowlist — see audit C1).
//
// Balance top-ups will be reintroduced during the payment-integration phase as
// a secure, webhook-driven flow (LiqPay): the balance must only ever be
// credited from a server-verified payment callback, never from a client request.
//
// Until then this endpoint returns 501 Not Implemented for every method.

function notImplemented() {
  return NextResponse.json(
    {
      error:
        "Balance top-up is temporarily disabled. It will be reintroduced via a secure payment webhook.",
    },
    { status: 501 }
  );
}

export const POST = notImplemented;
export const GET = notImplemented;
export const PUT = notImplemented;
export const PATCH = notImplemented;
export const DELETE = notImplemented;
