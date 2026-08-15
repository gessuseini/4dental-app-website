import { createHash, randomBytes } from "crypto";
import { productPrefix, type ProductSlug } from "@/lib/products";

function formatKey(prefix: string, digest: string) {
  const chunks = [
    digest.slice(0, 4),
    digest.slice(4, 8),
    digest.slice(8, 12),
    digest.slice(12, 16),
  ];
  return `${prefix}-${chunks.join("-")}`;
}

/** Stable key for a Paddle transaction (idempotent fulfillment). */
export function licenseKeyForTransaction(product: ProductSlug, transactionId: string) {
  const digest = createHash("sha256")
    .update(`4dental-${product}:${transactionId}`)
    .digest("hex")
    .toUpperCase();
  return formatKey(productPrefix(product), digest);
}

/** Manual / promo keys. */
export function generateLicenseKey(product: ProductSlug) {
  const digest = randomBytes(16).toString("hex").toUpperCase();
  return formatKey(productPrefix(product), digest);
}
