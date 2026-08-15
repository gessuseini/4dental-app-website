import { NextResponse } from "next/server";
import type { TransactionNotification } from "@paddle/paddle-node-sdk";
import { getSession, writeAuditLog } from "@/lib/auth/session";
import { getPaddleServer } from "@/lib/paddle/server";
import { upsertPaymentFromTransaction } from "@/lib/paddle/process-webhook";

/** Pull recent Paddle transactions into the local dashboard DB. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { allowPaddleFetch, isPaddleCoolingDown, isRateLimitError, markPaddleRateLimited } =
      await import("@/lib/paddle/cache");
    if (isPaddleCoolingDown() || !allowPaddleFetch("admin-import", 5 * 60_000)) {
      return NextResponse.json(
        { error: "Import throttled. Wait a few minutes — payments already sync from checkout automatically." },
        { status: 429 },
      );
    }

    const paddle = getPaddleServer();
    const collection = paddle.transactions.list({ perPage: 50 });
    let imported = 0;

    for await (const txn of collection) {
      const issueLicense =
        txn.status === "completed" || txn.status === "paid" || txn.status === "billed";
      await upsertPaymentFromTransaction(
        txn as unknown as TransactionNotification,
        "admin.import",
        { issueLicense },
      );
      imported += 1;
      // Cap import volume to protect sandbox API quota
      if (imported >= 25) break;
    }

    await writeAuditLog({
      adminId: session.sub,
      action: "payments_imported_from_paddle",
      meta: { imported },
    });

    return NextResponse.json({ ok: true, imported });
  } catch (error) {
    console.error("[admin] import payments failed", error);
    const { isRateLimitError, markPaddleRateLimited } = await import("@/lib/paddle/cache");
    if (isRateLimitError(error)) markPaddleRateLimited();
    return NextResponse.json(
      { error: "Could not import from Paddle. Check PADDLE_API_KEY." },
      { status: 502 },
    );
  }
}
