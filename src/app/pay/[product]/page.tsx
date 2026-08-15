import { notFound } from "next/navigation";
import { PayCheckout } from "@/components/pay-checkout";
import { isProductSlug, productLabel } from "@/lib/products";

type Props = { params: Promise<{ product: string }> };

export async function generateMetadata({ params }: Props) {
  const { product } = await params;
  if (!isProductSlug(product)) return { title: "Checkout" };
  return {
    title: `Buy ${productLabel(product)} — 4Dental`,
    robots: { index: false, follow: false },
  };
}

export default async function PayProductPage({ params }: Props) {
  const { product } = await params;
  if (!isProductSlug(product)) notFound();
  return <PayCheckout product={product} />;
}
