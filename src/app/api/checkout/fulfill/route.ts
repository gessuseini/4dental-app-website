import { NextRequest, NextResponse } from "next/server";
import { extractTransactionId, verifyCheckoutSuccess } from "@/lib/paddle/verify-checkout";

export const runtime = "nodejs";

/**
 * Public fulfill endpoint used by the success page.
 * Verifies the Paddle transaction and auto-saves payment + license entitlement.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const txn = extractTransactionId({
    txn: sp.get("txn") ?? undefined,
    _ptxn: sp.get("_ptxn") ?? undefined,
    transaction_id: sp.get("transaction_id") ?? undefined,
  });

  const result = await verifyCheckoutSuccess(txn);
  if (!result.ok) {
    const status =
      result.code === "unpaid" ? 402 : result.code === "api_key" ? 503 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    txn?: string;
    _ptxn?: string;
    transaction_id?: string;
  };
  const txn = extractTransactionId(body);
  const result = await verifyCheckoutSuccess(txn);
  if (!result.ok) {
    const status =
      result.code === "unpaid" ? 402 : result.code === "api_key" ? 503 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
