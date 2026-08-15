import { prisma } from "@/lib/db";
import { licenseKeyForTransaction } from "@/lib/licenses/keys";
import { isProductSlug, type ProductSlug } from "@/lib/products";
import type { VerifiedCheckout } from "@/lib/paddle/verify-checkout";

const INTENT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function createCheckoutIntent(product: ProductSlug) {
  return prisma.checkoutIntent.create({
    data: { product, status: "open" },
  });
}

/**
 * Fulfill a paid checkout without calling Paddle API.
 * Used when Cloudflare rate-limits sandbox-api, or when an intent proves
 * the buyer started checkout from our /pay page.
 */
export async function fulfillFromTrustedCheckout(input: {
  transactionId: string;
  product: ProductSlug;
  intentId?: string | null;
  email?: string | null;
  customerName?: string | null;
}): Promise<VerifiedCheckout | null> {
  const { transactionId, product } = input;
  if (!isProductSlug(product)) return null;

  if (input.intentId) {
    const intent = await prisma.checkoutIntent.findUnique({
      where: { id: input.intentId },
    });
    if (!intent || intent.status !== "open") return null;
    if (intent.product !== product) return null;
    if (Date.now() - intent.createdAt.getTime() > INTENT_TTL_MS) {
      await prisma.checkoutIntent.update({
        where: { id: intent.id },
        data: { status: "expired" },
      });
      return null;
    }
    await prisma.checkoutIntent.update({
      where: { id: intent.id },
      data: {
        status: "consumed",
        txnId: transactionId,
        consumedAt: new Date(),
      },
    });
  } else if (process.env.ALLOW_OFFLINE_CHECKOUT_FULFILL !== "true") {
    return null;
  }

  const email =
    input.email?.trim().toLowerCase() ||
    `buyer+${transactionId.toLowerCase()}@checkout.local`;

  const customer = await prisma.customer.upsert({
    where: { email },
    update: { name: input.customerName ?? undefined },
    create: { email, name: input.customerName ?? null },
  });

  const payment = await prisma.payment.upsert({
    where: { paddleTransactionId: transactionId },
    update: {
      product,
      status: "completed",
      lastEventType: "checkout.offline_fulfill",
      customerId: customer.id,
    },
    create: {
      paddleTransactionId: transactionId,
      product,
      status: "completed",
      lastEventType: "checkout.offline_fulfill",
      customerId: customer.id,
    },
  });

  const orderKey = licenseKeyForTransaction(product, transactionId);
  let license = await prisma.license.findUnique({ where: { key: orderKey } });
  if (!license) {
    license = await prisma.license.create({
      data: {
        key: orderKey,
        product,
        status: "active",
        licenseType: "lifetime",
        userName: customer.name,
        customerId: customer.id,
        paymentId: payment.id,
        activatedAt: new Date(),
      },
    });
  } else {
    license = await prisma.license.update({
      where: { id: license.id },
      data: {
        customerId: customer.id,
        paymentId: payment.id,
        product,
        userName: customer.name ?? undefined,
        status: license.status === "revoked" ? "revoked" : "active",
        activatedAt: license.activatedAt ?? new Date(),
      },
    });
  }

  if (customer.email && !customer.email.endsWith("@checkout.local")) {
    const { sendPurchaseLicenseEmail } = await import("@/lib/email/purchase-license");
    void sendPurchaseLicenseEmail({
      to: customer.email,
      customerName: customer.name,
      product,
      licenseKey: license.key,
      transactionId,
      licenseId: license.id,
    });
  }

  return {
    ok: true,
    transactionId,
    product,
    email: customer.email,
    customerName: customer.name,
    orderKey: license.key,
    activationKey: license.key,
    hwid: license.hwid,
    licenseStatus: license.status,
    status: "completed",
  };
}
