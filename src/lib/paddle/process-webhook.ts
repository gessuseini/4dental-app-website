import {
  EventName,
  type EventEntity,
  type TransactionNotification,
} from "@paddle/paddle-node-sdk";
import { prisma } from "@/lib/db";
import { licenseKeyForTransaction } from "@/lib/licenses/keys";
import { getPaddleServer } from "@/lib/paddle/server";
import { asString, paymentFieldsFromTransaction } from "@/lib/paddle/payment-fields";

type CustomerInfo = {
  email: string | null;
  name: string | null;
  country: string | null;
  locale: string | null;
  rawJson: string | null;
};

function countryFromTxn(txn: TransactionNotification): string | null {
  const raw = txn as unknown as {
    billingDetails?: { countryCode?: string | null } | null;
    address?: { countryCode?: string | null } | null;
  };
  return (
    asString(raw.billingDetails?.countryCode) ||
    asString(raw.address?.countryCode) ||
    null
  );
}

function nameFromTxn(txn: TransactionNotification): string | null {
  const raw = txn as unknown as {
    customer?: { name?: string | null; email?: string | null } | null;
    customData?: Record<string, unknown> | null;
    payments?: Array<{
      methodDetails?: {
        card?: { cardholderName?: string | null } | null;
      } | null;
    }>;
  };

  // Card checkout collects "Name on card" — this is the reliable name field
  const payments = raw.payments ?? [];
  for (let i = payments.length - 1; i >= 0; i--) {
    const cardName = asString(payments[i]?.methodDetails?.card?.cardholderName);
    if (cardName) return cardName;
  }

  return (
    asString(raw.customer?.name) ||
    asString(raw.customData?.customerName) ||
    asString(raw.customData?.name) ||
    null
  );
}

function emailFromTxn(txn: TransactionNotification): string | null {
  const raw = txn as unknown as {
    customer?: { email?: string | null } | null;
  };
  return asString(raw.customer?.email);
}

async function fetchPaddleCustomer(customerId: string): Promise<CustomerInfo | null> {
  try {
    const { allowPaddleFetch, isPaddleCoolingDown } = await import("@/lib/paddle/cache");
    if (isPaddleCoolingDown() || !allowPaddleFetch(`customer:${customerId}`, 5 * 60_000)) {
      return null;
    }
    const paddle = getPaddleServer();
    const customer = await paddle.customers.get(customerId);
    return {
      email: asString(customer.email),
      name: asString(customer.name),
      country: null, // country lives on Address, not Customer
      locale: asString(customer.locale),
      rawJson: JSON.stringify(customer),
    };
  } catch (error) {
    console.error("[paddle] customer lookup failed", customerId, error);
    const { isRateLimitError, markPaddleRateLimited } = await import("@/lib/paddle/cache");
    if (isRateLimitError(error)) markPaddleRateLimited();
    return null;
  }
}

async function fetchPaddleAddressCountry(
  customerId: string,
  addressId: string,
): Promise<string | null> {
  try {
    const { allowPaddleFetch, isPaddleCoolingDown } = await import("@/lib/paddle/cache");
    if (
      isPaddleCoolingDown() ||
      !allowPaddleFetch(`address:${addressId}`, 5 * 60_000)
    ) {
      return null;
    }
    const paddle = getPaddleServer();
    const address = await paddle.addresses.get(customerId, addressId);
    return asString(address.countryCode);
  } catch (error) {
    console.error("[paddle] address lookup failed", customerId, addressId, error);
    const { isRateLimitError, markPaddleRateLimited } = await import("@/lib/paddle/cache");
    if (isRateLimitError(error)) markPaddleRateLimited();
    return null;
  }
}

/**
 * Resolve email / name / country for a Paddle transaction.
 * Country usually comes from the billing address (addressId), not the customer record.
 * Name is often null in Paddle checkout unless the buyer entered one.
 */
async function resolveCustomerForTxn(txn: TransactionNotification): Promise<CustomerInfo> {
  const customerId = asString(txn.customerId);
  const addressId = asString(
    (txn as unknown as { addressId?: string | null }).addressId,
  );

  let email = emailFromTxn(txn);
  let name = nameFromTxn(txn);
  let country = countryFromTxn(txn);
  let locale: string | null = null;
  let rawJson: string | null = null;

  if (customerId) {
    const existing = await prisma.customer.findFirst({
      where: { paddleCustomerId: customerId },
    });
    if (existing) {
      email = email || existing.email;
      name = name || existing.name;
      country = country || existing.country;
      locale = existing.locale;
      rawJson = existing.rawJson;
    }
  }

  // Fill missing email/name from Customers API (gated)
  if (customerId && (!email || !name || !rawJson)) {
    const remote = await fetchPaddleCustomer(customerId);
    if (remote) {
      email = email || remote.email;
      name = name || remote.name;
      locale = locale || remote.locale;
      rawJson = remote.rawJson || rawJson;
    }
  }

  // Fill country from Addresses API (gated) — this is where Paddle stores it
  if (customerId && addressId && !country) {
    country = await fetchPaddleAddressCountry(customerId, addressId);
  }

  return { email, name, country, locale, rawJson };
}

async function markEventProcessed(event: EventEntity) {
  await prisma.webhookEvent.upsert({
    where: { eventId: event.eventId },
    update: { processed: true, eventType: event.eventType, payloadJson: JSON.stringify(event) },
    create: {
      eventId: event.eventId,
      eventType: event.eventType,
      processed: true,
      payloadJson: JSON.stringify(event),
    },
  });
}

async function upsertCustomerForTxn(txn: TransactionNotification) {
  const info = await resolveCustomerForTxn(txn);
  const email = (info.email ?? `unknown+${txn.id}@paddle.local`).toLowerCase();

  return prisma.customer.upsert({
    where: { email },
    update: {
      name: info.name ?? undefined,
      paddleCustomerId: asString(txn.customerId) ?? undefined,
      country: info.country ?? undefined,
      locale: info.locale ?? undefined,
      rawJson: info.rawJson ?? undefined,
    },
    create: {
      email,
      name: info.name,
      paddleCustomerId: asString(txn.customerId),
      country: info.country,
      locale: info.locale,
      rawJson: info.rawJson,
    },
  });
}

/**
 * Upsert a payment from any Paddle transaction lifecycle event.
 * Licenses are issued only when status is completed/paid.
 */
export async function upsertPaymentFromTransaction(
  txn: TransactionNotification,
  eventType: string,
  options?: { issueLicense?: boolean },
) {
  const fields = paymentFieldsFromTransaction(
    txn as unknown as Parameters<typeof paymentFieldsFromTransaction>[0],
    eventType,
  );
  const customer = await upsertCustomerForTxn(txn);
  const issueLicense =
    options?.issueLicense ??
    (fields.status === "completed" || fields.status === "paid" || eventType === EventName.TransactionCompleted);

  const payment = await prisma.payment.upsert({
    where: { paddleTransactionId: txn.id },
    update: {
      ...fields,
      customerCountry: fields.customerCountry ?? customer.country ?? undefined,
      customerId: customer.id,
    },
    create: {
      ...fields,
      customerCountry: fields.customerCountry ?? customer.country ?? null,
      customerId: customer.id,
    },
    include: { customer: true, licenses: true },
  });

  if (!issueLicense) {
    return { payment, license: payment.licenses[0] ?? null, customer };
  }

  const licenseKey = licenseKeyForTransaction(
    fields.product === "lab" ? "lab" : "clinic",
    txn.id,
  );

  // Customer-facing license key (4DC-… / 4DL-…) is ready immediately — no HWID step.
  const license = await prisma.license.upsert({
    where: { key: licenseKey },
    update: {
      customerId: customer.id,
      paymentId: payment.id,
      product: fields.product,
      userName: customer.name ?? undefined,
      status: payment.licenses[0]?.status === "revoked" ? "revoked" : "active",
      activatedAt: payment.licenses[0]?.activatedAt ?? new Date(),
    },
    create: {
      key: licenseKey,
      product: fields.product,
      status: "active",
      licenseType: "lifetime",
      userName: customer.name,
      customerId: customer.id,
      paymentId: payment.id,
      activatedAt: new Date(),
    },
  });

  console.info("[paddle] license key ready", {
    email: customer.email,
    product: fields.product,
    orderKey: license.key,
    transactionId: txn.id,
    status: fields.status,
  });

  if (customer.email && !customer.email.endsWith("@checkout.local")) {
    const { sendPurchaseLicenseEmail } = await import("@/lib/email/purchase-license");
    void sendPurchaseLicenseEmail({
      to: customer.email,
      customerName: customer.name,
      product: fields.product === "lab" ? "lab" : "clinic",
      licenseKey: license.key,
      transactionId: txn.id,
      licenseId: license.id,
    });
  }

  return { payment, license, customer };
}

async function handleCustomerEvent(event: EventEntity) {
  const data = event.data as {
    id?: string;
    email?: string;
    name?: string | null;
    locale?: string | null;
  };
  const email = asString(data.email);
  if (!email) return;

  await prisma.customer.upsert({
    where: { email },
    update: {
      name: asString(data.name) ?? undefined,
      paddleCustomerId: asString(data.id) ?? undefined,
      locale: asString(data.locale) ?? undefined,
      rawJson: JSON.stringify(data),
    },
    create: {
      email,
      name: asString(data.name),
      paddleCustomerId: asString(data.id),
      locale: asString(data.locale),
      rawJson: JSON.stringify(data),
    },
  });
}

export async function processPaddleEvent(event: EventEntity) {
  console.info("[paddle] event", event.eventType, event.eventId);

  const already = await prisma.webhookEvent.findUnique({ where: { eventId: event.eventId } });
  if (already?.processed) {
    console.info("[paddle] duplicate event ignored", event.eventId);
    return;
  }

  switch (event.eventType) {
    case EventName.TransactionCreated:
    case EventName.TransactionUpdated:
    case EventName.TransactionReady:
    case EventName.TransactionBilled:
    case EventName.TransactionPaid:
    case EventName.TransactionPastDue:
    case EventName.TransactionPaymentFailed:
    case EventName.TransactionCanceled:
    case EventName.TransactionCompleted:
    case EventName.TransactionRevised: {
      const txn = event.data as TransactionNotification;
      const issueLicense =
        event.eventType === EventName.TransactionCompleted ||
        event.eventType === EventName.TransactionPaid ||
        txn.status === "completed" ||
        txn.status === "paid";
      await upsertPaymentFromTransaction(txn, event.eventType, { issueLicense });
      break;
    }
    case EventName.CustomerCreated:
    case EventName.CustomerUpdated:
    case EventName.CustomerImported:
      await handleCustomerEvent(event);
      break;
    default:
      break;
  }

  await markEventProcessed(event);
}
