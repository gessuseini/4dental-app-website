"use client";

import Image from "next/image";
import Link from "next/link";
import type { Paddle } from "@paddle/paddle-js";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isPaddleCheckoutConfigured, priceIdForProduct } from "@/lib/paddle/config";
import { getPaddle, rememberCheckoutContext } from "@/lib/paddle/client";
import { productLabel, type ProductSlug } from "@/lib/products";
import { siteConfig } from "@/lib/site";

export function PayCheckout({ product }: { product: ProductSlug }) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState(false);
  const configured = isPaddleCheckoutConfigured(product);
  const label = productLabel(product);
  const returnUrl =
    product === "clinic" ? siteConfig.clinic.url : siteConfig.lab.url;
  const accent = product === "clinic" ? "var(--clinic)" : "var(--lab)";

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    getPaddle().then((instance) => {
      if (!cancelled && instance) setPaddle(instance);
    });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  async function openCheckout() {
    if (!configured || !paddle || opening) return;
    setOpening(true);
    try {
      const intentRes = await fetch("/api/checkout/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const intentJson = await intentRes.json();
      const intentId = intentJson.intentId as string | undefined;
      if (intentId) rememberCheckoutContext(intentId, product);

      paddle.Checkout.open({
        items: [{ priceId: priceIdForProduct(product), quantity: 1 }],
        customData: { product, intentId: intentId ?? "" },
        settings: {
          variant: "one-page",
          displayMode: "overlay",
          theme: "light",
        },
      });
    } catch (err) {
      console.error("[Paddle] Checkout.open failed", err);
      setError(true);
      window.setTimeout(() => setError(false), 3000);
    } finally {
      setOpening(false);
    }
  }

  const ready = configured && Boolean(paddle);

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 55% 45% at 30% 20%, color-mix(in srgb, ${accent} 24%, transparent), transparent)`,
        }}
      />
      <Card className="relative z-10 w-full max-w-lg border-border/80 shadow-sm">
        <CardHeader className="items-center text-center">
          <Image
            src={product === "clinic" ? siteConfig.clinic.logo : siteConfig.lab.logo}
            alt=""
            width={64}
            height={64}
            className="mb-2 size-16"
            unoptimized
          />
          <CardTitle className="font-display text-2xl">Buy {label}</CardTitle>
          <CardDescription>
            Secure checkout on 4dental.app via Paddle. After payment you get a license key
            (4DC-… / 4DL-…) plus download and activation instructions — no Hardware ID needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!configured ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Checkout is not configured yet. Add Paddle price IDs for {product} in environment
              variables.
            </p>
          ) : null}
          <Button size="lg" className="w-full" disabled={!ready || opening} onClick={openCheckout}>
            {error ? "Try again" : opening ? "Starting…" : ready ? `Continue to payment` : "Loading checkout…"}
          </Button>
          <Link
            href={returnUrl}
            className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted"
          >
            Back to {label} website
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Payments processed by Paddle (Merchant of Record).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
