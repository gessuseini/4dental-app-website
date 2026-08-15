import type { TransactionNotification } from "@paddle/paddle-node-sdk";
import { getPaddleServer } from "@/lib/paddle/server";
import { prisma } from "@/lib/db";
import { resolveProductFromCheckout } from "@/lib/paddle/config";
import { licenseKeyForTransaction } from "@/lib/licenses/keys";
import { upsertPaymentFromTransaction } from "@/lib/paddle/process-webhook";
import { fulfillFromTrustedCheckout } from "@/lib/paddle/offline-fulfill";
import {
  allowPaddleFetch,
  cacheGet,
  cacheSet,
  isPaddleCoolingDown,
  isRateLimitError,
  markPaddleRateLimited,
  paddleCooldownRemainingMs,
} from "@/lib/paddle/cache";
import { isProductSlug, type ProductSlug } from "@/lib/products";

const PAID_STATUSES = new Set(["completed", "paid", "billed"]);

export type VerifiedCheckout = {
  ok: true;
  transactionId: string;
  product: ProductSlug;
  email: string | null;
  customerName: string | null;
  orderKey: string | null;
  activationKey: string | null;
  hwid: string | null;
  licenseStatus: string | null;
  status: string;
};

export type FailedCheckout = {
  ok: false;
  reason: string;
  code?: "missing" | "invalid" | "unpaid" | "api_key" | "rate_limit" | "error";
  /** When rate-limited, UI can finish fulfillment offline for this txn. */
  canOfflineFulfill?: boolean;
};

export type VerifyOptions = {
  product?: string | null;
  intentId?: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function extractTransactionId(params: {
  txn?: string | string[];
  _ptxn?: string | string[];
  transaction_id?: string | string[];
}) {
  const raw = params.txn ?? params._ptxn ?? params.transaction_id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

function isTransactionId(value: string) {
  return /^txn_[a-z0-9]+$/i.test(value);
}

function fromLocalPayment(
  transactionId: string,
  payment: {
    product: string;
    status: string;
    customer: { email: string; name: string | null } | null;
    licenses: Array<{
      key: string;
      activationKey: string | null;
      hwid: string | null;
      status: string;
    }>;
  },
): VerifiedCheckout {
  const product = (payment.product === "lab" ? "lab" : "clinic") as ProductSlug;
  const license = payment.licenses[0] ?? null;
  return {
    ok: true,
    transactionId,
    product,
    email: payment.customer?.email ?? null,
    customerName: payment.customer?.name ?? null,
    orderKey: license?.key ?? licenseKeyForTransaction(product, transactionId),
    activationKey: license?.key ?? null,
    hwid: license?.hwid ?? null,
    licenseStatus: license?.status ?? "active",
    status: payment.status,
  };
}

async function loadLocalPayment(transactionId: string) {
  return prisma.payment.findUnique({
    where: { paddleTransactionId: transactionId },
    include: { licenses: true, customer: true },
  });
}

async function tryOfflineFulfill(
  transactionId: string,
  options?: VerifyOptions,
): Promise<VerifiedCheckout | null> {
  const productHint = options?.product;
  const product = productHint && isProductSlug(productHint) ? productHint : null;

  let resolvedProduct = product;
  if (!resolvedProduct && options?.intentId) {
    const intent = await prisma.checkoutIntent.findUnique({
      where: { id: options.intentId },
    });
    if (intent && isProductSlug(intent.product)) resolvedProduct = intent.product;
  }
  if (!resolvedProduct) return null;

  const offline = await fulfillFromTrustedCheckout({
    transactionId,
    product: resolvedProduct,
    intentId: options?.intentId,
  });
  if (offline) cacheSet(`txn:${transactionId}`, offline);
  return offline;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Automatic checkout verify:
 * 1) Memory cache
 * 2) Local DB (webhook or prior verify)
 * 3) Brief wait for webhook, recheck local (avoids extra Paddle calls)
 * 4) One Paddle API fetch (gated)
 * 5) Offline/intent fallback only if rate-limited
 */
export async function verifyCheckoutSuccess(
  transactionId: string,
  options?: VerifyOptions,
): Promise<VerifiedCheckout | FailedCheckout> {
  if (!transactionId) {
    return { ok: false, reason: "No completed payment found.", code: "missing" };
  }
  if (!isTransactionId(transactionId)) {
    return { ok: false, reason: "Invalid payment reference.", code: "invalid" };
  }

  const cacheKey = `txn:${transactionId}`;
  const cached = cacheGet<VerifiedCheckout>(cacheKey);
  if (cached?.ok) return cached;

  let local = await loadLocalPayment(transactionId);
  if (local && PAID_STATUSES.has(local.status)) {
    const verified = fromLocalPayment(transactionId, local);
    cacheSet(cacheKey, verified);
    return verified;
  }

  // Give webhook a moment to land before calling Paddle (saves API quota)
  if (!local || !PAID_STATUSES.has(local.status)) {
    await sleep(1200);
    local = await loadLocalPayment(transactionId);
    if (local && PAID_STATUSES.has(local.status)) {
      const verified = fromLocalPayment(transactionId, local);
      cacheSet(cacheKey, verified);
      return verified;
    }
  }

  if (isPaddleCoolingDown() || !allowPaddleFetch(cacheKey)) {
    const offline = await tryOfflineFulfill(transactionId, options);
    if (offline) return offline;
    const mins = Math.ceil(paddleCooldownRemainingMs() / 60_000) || 1;
    return {
      ok: false,
      reason: isPaddleCoolingDown()
        ? `Paddle API is cooling down (~${mins} min). Use Continue activation below — no more Paddle calls.`
        : "Payment is still syncing. Wait ~45s, then refresh once — or use Continue activation.",
      code: "rate_limit",
      canOfflineFulfill: true,
    };
  }

  try {
    const paddle = getPaddleServer();
    const txn = await paddle.transactions.get(transactionId);
    const status = String(txn.status ?? "");

    if (!PAID_STATUSES.has(status)) {
      return {
        ok: false,
        reason: `Payment is not completed yet (status: ${status}). Wait a bit, then refresh once.`,
        code: "unpaid",
      };
    }

    await upsertPaymentFromTransaction(txn as unknown as TransactionNotification, "checkout.success", {
      issueLicense: true,
    });

    const payment = await loadLocalPayment(transactionId);
    if (!payment) {
      return { ok: false, reason: "Payment verified but could not be saved locally.", code: "error" };
    }

    const verified = fromLocalPayment(transactionId, payment);

    const customProduct = asString(
      (txn.customData as Record<string, unknown> | null | undefined)?.product,
    );
    if (customProduct && isProductSlug(customProduct)) {
      verified.product = customProduct;
    } else {
      const priceIds = (txn.items ?? [])
        .map((item) => item.price?.id)
        .filter((id): id is string => Boolean(id));
      verified.product = resolveProductFromCheckout({ priceIds, customProduct });
    }

    cacheSet(cacheKey, verified);
    return verified;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[checkout/success] verify failed", transactionId, error);

    if (isRateLimitError(error) || message.includes("<!doctype") || message.includes("Unexpected token")) {
      markPaddleRateLimited();
      const offline = await tryOfflineFulfill(transactionId, options);
      if (offline) return offline;
      return {
        ok: false,
        reason:
          "Paddle API is rate-limited. Click Continue activation — your payment is saved without calling Paddle again.",
        code: "rate_limit",
        canOfflineFulfill: true,
      };
    }

    if (message.includes("PADDLE_API_KEY") || message.includes("pdl_")) {
      const offline = await tryOfflineFulfill(transactionId, options);
      if (offline) return offline;
      return {
        ok: false,
        reason: "Paddle API key issue. Check PADDLE_API_KEY in .env, then try again.",
        code: "api_key",
        canOfflineFulfill: Boolean(options?.intentId || options?.product),
      };
    }

    return { ok: false, reason: "Could not verify this payment.", code: "error" };
  }
}
