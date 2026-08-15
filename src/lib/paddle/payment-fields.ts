import { resolveProductFromCheckout } from "@/lib/paddle/config";
import type { ProductSlug } from "@/lib/products";

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function extractPaymentMethod(txn: {
  payments?: Array<{
    status?: string | null;
    errorCode?: string | null;
    methodDetails?: {
      type?: string | null;
      card?: { type?: string | null; last4?: string | null } | null;
    } | null;
  }>;
}) {
  const payments = txn.payments ?? [];
  if (payments.length === 0) {
    return {
      paymentMethod: null as string | null,
      cardBrand: null as string | null,
      cardLast4: null as string | null,
      failureCode: null as string | null,
      failureReason: null as string | null,
    };
  }

  const latest = payments[payments.length - 1];
  const methodDetails = latest.methodDetails;
  const card = methodDetails?.card ?? null;
  const errorCode = asString(latest.errorCode);
  const status = asString(latest.status);

  return {
    paymentMethod: asString(methodDetails?.type),
    cardBrand: asString(card?.type),
    cardLast4: asString(card?.last4),
    failureCode: errorCode,
    failureReason:
      errorCode || status === "error" || status === "failed"
        ? errorCode || status
        : null,
  };
}

export function productFromTransaction(txn: {
  items?: Array<{ price?: { id?: string | null } | null }>;
  customData?: Record<string, unknown> | null;
}): ProductSlug {
  const priceIds = (txn.items ?? [])
    .map((item) => item.price?.id)
    .filter((id): id is string => Boolean(id));
  const customProduct =
    asString(txn.customData?.product) ?? asString(txn.customData?.Product);
  return resolveProductFromCheckout({ priceIds, customProduct });
}

export function paymentFieldsFromTransaction(
  txn: {
    id: string;
    status: string;
    currencyCode?: string | null;
    collectionMode?: string | null;
    origin?: string | null;
    invoiceNumber?: string | null;
    createdAt?: string | null;
    billedAt?: string | null;
    customData?: Record<string, unknown> | null;
    items?: Array<{ price?: { id?: string | null } | null }>;
    details?: {
      totals?: {
        grandTotal?: string | null;
        currencyCode?: string | null;
        tax?: string | null;
        subtotal?: string | null;
        discount?: string | null;
        earnings?: string | null;
      } | null;
    } | null;
    payments?: Array<{
      status?: string | null;
      errorCode?: string | null;
      methodDetails?: {
        type?: string | null;
        card?: { type?: string | null; last4?: string | null } | null;
      } | null;
    }>;
    billingDetails?: { countryCode?: string | null } | null;
    address?: { countryCode?: string | null } | null;
  },
  eventType?: string,
) {
  const totals = txn.details?.totals;
  const method = extractPaymentMethod(txn);
  const billedAtRaw = asString(txn.billedAt) ?? asString(txn.createdAt);

  return {
    paddleTransactionId: txn.id,
    product: productFromTransaction(txn),
    amount: asString(totals?.grandTotal),
    currency: asString(totals?.currencyCode) || asString(txn.currencyCode),
    status: asString(txn.status) ?? "unknown",
    lastEventType: eventType ?? null,
    collectionMode: asString(txn.collectionMode),
    origin: asString(txn.origin),
    invoiceNumber: asString(txn.invoiceNumber),
    paymentMethod: method.paymentMethod,
    cardBrand: method.cardBrand,
    cardLast4: method.cardLast4,
    failureCode: method.failureCode,
    failureReason: method.failureReason,
    customerCountry:
      asString(txn.billingDetails?.countryCode) || asString(txn.address?.countryCode),
    tax: asString(totals?.tax),
    subtotal: asString(totals?.subtotal),
    discount: asString(totals?.discount),
    earnings: asString(totals?.earnings),
    billedAt: billedAtRaw ? new Date(billedAtRaw) : null,
    rawJson: JSON.stringify(txn),
  };
}
