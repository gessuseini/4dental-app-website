export const PRODUCTS = ["clinic", "lab"] as const;
export type ProductSlug = (typeof PRODUCTS)[number];

export function isProductSlug(value: string): value is ProductSlug {
  return PRODUCTS.includes(value as ProductSlug);
}

export function productLabel(product: ProductSlug | string) {
  if (product === "clinic") return "4Dental Clinic";
  if (product === "lab") return "4Dental Lab";
  return product;
}

export function productPrefix(product: ProductSlug) {
  return product === "clinic" ? "4DC" : "4DL";
}
