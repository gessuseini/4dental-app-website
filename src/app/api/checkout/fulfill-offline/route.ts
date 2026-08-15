import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cacheSet } from "@/lib/paddle/cache";
import { fulfillFromTrustedCheckout } from "@/lib/paddle/offline-fulfill";

const schema = z.object({
  txn: z.string().regex(/^txn_[a-z0-9]+$/i),
  product: z.enum(["clinic", "lab"]),
  intentId: z.string().min(8).optional(),
});

/**
 * Complete fulfillment when Paddle API is rate-limited.
 * Requires either a checkout intent from /pay, or ALLOW_OFFLINE_CHECKOUT_FULFILL=true.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await fulfillFromTrustedCheckout({
    transactionId: parsed.data.txn,
    product: parsed.data.product,
    intentId: parsed.data.intentId,
  });

  if (!result) {
    return NextResponse.json(
      {
        error:
          "Could not fulfill offline. Start checkout again from /pay/clinic (or enable ALLOW_OFFLINE_CHECKOUT_FULFILL for sandbox).",
      },
      { status: 403 },
    );
  }

  cacheSet(`txn:${result.transactionId}`, result);
  return NextResponse.json(result);
}
