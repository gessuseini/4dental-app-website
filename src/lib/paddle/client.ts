"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { paddleConfig } from "@/lib/paddle/config";

let paddlePromise: Promise<Paddle | undefined> | null = null;

const STORAGE_INTENT = "4dental_checkout_intent";
const STORAGE_PRODUCT = "4dental_checkout_product";

export function rememberCheckoutContext(intentId: string, product: string) {
  try {
    sessionStorage.setItem(STORAGE_INTENT, intentId);
    sessionStorage.setItem(STORAGE_PRODUCT, product);
  } catch {
    /* ignore */
  }
}

function readCheckoutContext() {
  try {
    return {
      intentId: sessionStorage.getItem(STORAGE_INTENT),
      product: sessionStorage.getItem(STORAGE_PRODUCT),
    };
  } catch {
    return { intentId: null, product: null };
  }
}

function redirectToSuccess(transactionId: string) {
  const ctx = readCheckoutContext();
  const params = new URLSearchParams({ txn: transactionId });
  if (ctx.intentId) params.set("intent", ctx.intentId);
  if (ctx.product) params.set("product", ctx.product);
  window.location.assign(`${paddleConfig.successPath}?${params.toString()}`);
}

function redirectToCancelled() {
  window.location.assign(paddleConfig.cancelPath);
}

/** Single shared Paddle.js instance — calling initializePaddle twice breaks checkout. */
export function getPaddle(): Promise<Paddle | undefined> {
  if (!paddleConfig.clientToken) {
    return Promise.resolve(undefined);
  }

  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token: paddleConfig.clientToken,
      environment: paddleConfig.environment,
      debug: paddleConfig.environment === "sandbox",
      eventCallback: (event) => {
        if (event.name === "checkout.completed") {
          const data = event.data as {
            transaction_id?: string;
            id?: string;
            transactionId?: string;
          } | null;
          const transactionId =
            data?.transaction_id || data?.transactionId || data?.id;
          if (transactionId) redirectToSuccess(String(transactionId));
          return;
        }

        if (event.name === "checkout.closed") {
          return;
        }

        if (
          event.name === "checkout.error" ||
          event.name === "checkout.failed" ||
          event.name === "checkout.payment.error" ||
          event.name === "checkout.payment.failed"
        ) {
          console.error("[Paddle checkout]", event.name, event);
          redirectToCancelled();
        }
      },
    }).catch((err) => {
      console.error("[Paddle] initialize failed", err);
      paddlePromise = null;
      return undefined;
    });
  }

  return paddlePromise;
}
