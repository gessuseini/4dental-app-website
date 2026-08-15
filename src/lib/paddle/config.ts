import type { Environments } from "@paddle/paddle-js";
import type { ProductSlug } from "@/lib/products";
import { isProductSlug } from "@/lib/products";

const sharedPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID ?? "";

export const paddleConfig = {
  clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "",
  environment: (process.env.NEXT_PUBLIC_PADDLE_ENV ?? "sandbox") as Environments,
  priceIds: {
    clinic: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_CLINIC || sharedPriceId,
    lab: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_LAB || sharedPriceId,
  },
  successPath: "/checkout/success",
  cancelPath: "/checkout/cancelled",
} as const;

export function priceIdForProduct(product: ProductSlug) {
  return paddleConfig.priceIds[product];
}

export function isPaddleCheckoutConfigured(product: ProductSlug) {
  return Boolean(paddleConfig.clientToken && priceIdForProduct(product));
}

/** Prefer customData.product when Clinic/Lab share one sandbox price ID. */
export function resolveProductFromCheckout(input: {
  priceIds?: string[];
  customProduct?: string | null;
}): ProductSlug {
  if (input.customProduct && isProductSlug(input.customProduct)) {
    return input.customProduct;
  }
  for (const id of input.priceIds ?? []) {
    if (id && id === paddleConfig.priceIds.clinic && id !== paddleConfig.priceIds.lab) {
      return "clinic";
    }
    if (id && id === paddleConfig.priceIds.lab && id !== paddleConfig.priceIds.clinic) {
      return "lab";
    }
  }
  // Shared price ID for both — default clinic unless customData said otherwise
  return "clinic";
}

export function productFromPriceId(priceId: string | null | undefined): ProductSlug | null {
  if (!priceId) return null;
  const { clinic, lab } = paddleConfig.priceIds;
  if (priceId === clinic && priceId === lab) return null; // ambiguous — use customData
  if (priceId === clinic) return "clinic";
  if (priceId === lab) return "lab";
  return null;
}
