import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { TransactionNotification } from "@paddle/paddle-node-sdk";
import { prisma } from "@/lib/db";
import { generateDesktopLicenseKey } from "@/lib/licenses/desktop-keygen";
import { licenseKeyForTransaction } from "@/lib/licenses/keys";
import { getPaddleServer } from "@/lib/paddle/server";
import { upsertPaymentFromTransaction } from "@/lib/paddle/process-webhook";
import { productLabel, type ProductSlug } from "@/lib/products";

export const runtime = "nodejs";

const schema = z.object({
  txn: z.string().min(4),
  hwid: z.string().min(8).max(256),
  userName: z.string().min(1).max(120).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a valid Hardware ID (and optional name)." },
      { status: 400 },
    );
  }

  const txnId = parsed.data.txn.trim();
  const hwid = parsed.data.hwid.trim();
  const userName = (parsed.data.userName || "").trim();

  let payment = await prisma.payment.findUnique({
    where: { paddleTransactionId: txnId },
    include: { licenses: true, customer: true },
  });

  const paid = (status: string) => ["completed", "paid", "billed"].includes(status);

  // Prefer local DB (success page / webhook already fulfilled). Only hit Paddle once if missing.
  if (!payment || !paid(payment.status)) {
    const { allowPaddleFetch, isPaddleCoolingDown, isRateLimitError, markPaddleRateLimited } =
      await import("@/lib/paddle/cache");

    if (isPaddleCoolingDown() || !allowPaddleFetch(`activate:${txnId}`, 60_000)) {
      return NextResponse.json(
        {
          error:
            "Payment is still syncing locally. Open the success page once, wait a few seconds, then try again. Avoid refreshing repeatedly.",
        },
        { status: 429 },
      );
    }

    try {
      const paddle = getPaddleServer();
      const txn = await paddle.transactions.get(txnId);
      if (txn.status !== "completed" && txn.status !== "paid" && txn.status !== "billed") {
        return NextResponse.json(
          { error: "Payment is not completed yet. Wait a moment and try again." },
          { status: 402 },
        );
      }
      const result = await upsertPaymentFromTransaction(
        txn as unknown as TransactionNotification,
        "checkout.activate",
        { issueLicense: true },
      );
      payment = await prisma.payment.findUnique({
        where: { id: result.payment.id },
        include: { licenses: true, customer: true },
      });
    } catch (error) {
      console.error("[activate-purchase] paddle lookup failed", error);
      if (isRateLimitError(error)) markPaddleRateLimited();
      return NextResponse.json(
        { error: "Payment not found or could not be verified. Open /checkout/success?txn=… first." },
        { status: 404 },
      );
    }
  }

  if (!payment || !paid(payment.status)) {
    return NextResponse.json(
      { error: "Only successful payments can get a license." },
      { status: 402 },
    );
  }

  const product = (payment.product === "lab" ? "lab" : "clinic") as ProductSlug;
  let license = payment.licenses[0] ?? null;

  if (!license) {
    const orderKey = licenseKeyForTransaction(product, txnId);
    license = await prisma.license.create({
      data: {
        key: orderKey,
        product,
        status: "pending_hwid",
        licenseType: "lifetime",
        customerId: payment.customerId,
        paymentId: payment.id,
      },
    });
  }

  if (license.activationKey && license.hwid === hwid) {
    return NextResponse.json({
      ok: true,
      activationKey: license.activationKey,
      orderKey: license.key,
      product: license.product,
      productLabel: productLabel(license.product),
      alreadyIssued: true,
    });
  }

  if (license.activationKey && license.hwid && license.hwid !== hwid) {
    return NextResponse.json(
      {
        error:
          "A license was already issued for a different Hardware ID. Contact support to reset the device binding.",
      },
      { status: 409 },
    );
  }

  const displayName =
    userName ||
    license.userName ||
    payment.customer?.name ||
    payment.customer?.email ||
    productLabel(license.product);

  // Persist name entered on success page onto the customer row (Paddle often leaves name empty)
  if (userName && payment.customerId) {
    await prisma.customer.update({
      where: { id: payment.customerId },
      data: { name: userName },
    });
  }

  const { key: activationKey, payload } = generateDesktopLicenseKey({
    userName: displayName,
    hardwareId: hwid,
    type: (license.licenseType as "lifetime" | "year" | "month" | "trial") || "lifetime",
  });

  license = await prisma.license.update({
    where: { id: license.id },
    data: {
      activationKey,
      hwid,
      userName: displayName,
      status: "active",
      activatedAt: new Date(),
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      licenseType: payload.type,
    },
  });

  return NextResponse.json({
    ok: true,
    activationKey: license.activationKey,
    orderKey: license.key,
    product: license.product,
    productLabel: productLabel(license.product),
    alreadyIssued: false,
  });
}
