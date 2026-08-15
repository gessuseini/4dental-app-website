import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAuditLog } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getPaddleServer } from "@/lib/paddle/server";
import { upsertPaymentFromTransaction } from "@/lib/paddle/process-webhook";
import type { TransactionNotification } from "@paddle/paddle-node-sdk";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { customer: true, licenses: true },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ payment });
}

/** Pull latest transaction + customer from Paddle into the local DB. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "sync") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { allowPaddleFetch, isPaddleCoolingDown, isRateLimitError, markPaddleRateLimited } =
    await import("@/lib/paddle/cache");
  if (isPaddleCoolingDown() || !allowPaddleFetch(`admin-sync:${existing.paddleTransactionId}`, 60_000)) {
    return NextResponse.json(
      { error: "Paddle sync throttled. Wait about a minute before syncing again." },
      { status: 429 },
    );
  }

  try {
    const paddle = getPaddleServer();
    const txn = await paddle.transactions.get(existing.paddleTransactionId);
    const result = await upsertPaymentFromTransaction(
      txn as unknown as TransactionNotification,
      "admin.sync",
      {
        issueLicense: txn.status === "completed" || txn.status === "paid" || txn.status === "billed",
      },
    );
    return NextResponse.json({ payment: result.payment, license: result.license });
  } catch (error) {
    console.error("[admin] payment sync failed", error);
    if (isRateLimitError(error)) markPaddleRateLimited();
    return NextResponse.json({ error: "Could not sync from Paddle" }, { status: 502 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.license.deleteMany({ where: { paymentId: id } }),
    prisma.payment.delete({ where: { id } }),
  ]);

  await writeAuditLog({
    adminId: session.sub,
    action: "payment_deleted",
    meta: {
      paymentId: id,
      paddleTransactionId: existing.paddleTransactionId,
      product: existing.product,
    },
  });

  return NextResponse.json({ ok: true });
}
