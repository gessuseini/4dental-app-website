import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckoutSuccessClient } from "@/components/checkout-success-client";
import { RateLimitContinue } from "@/components/rate-limit-continue";
import { extractTransactionId, verifyCheckoutSuccess } from "@/lib/paddle/verify-checkout";
import { siteConfig } from "@/lib/site";

type Props = {
  searchParams: Promise<{
    txn?: string;
    _ptxn?: string;
    transaction_id?: string;
    intent?: string;
    product?: string;
  }>;
};

export const metadata = {
  title: "Payment success — 4Dental",
  robots: { index: false, follow: false },
};

const btnClass =
  "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90";

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const txn = extractTransactionId(params);
  const result = await verifyCheckoutSuccess(txn, {
    product: params.product,
    intentId: params.intent,
  });

  if (!result.ok) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>
              {result.code === "rate_limit"
                ? "Payment received — finishing without Paddle API"
                : result.code === "unpaid"
                  ? "Payment still processing"
                  : "Could not confirm payment"}
            </CardTitle>
            <CardDescription>{result.reason}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {txn ? (
              <p className="break-all font-mono text-xs text-muted-foreground">Ref: {txn}</p>
            ) : null}
            {result.canOfflineFulfill && txn ? (
              <RateLimitContinue txn={txn} intentId={params.intent} />
            ) : result.code === "unpaid" && txn ? (
              <Link href={`/checkout/success?txn=${encodeURIComponent(txn)}`} className={btnClass}>
                Refresh status (once)
              </Link>
            ) : (
              <Link href="/" className={btnClass}>
                Back to 4Dental.app
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const returnUrl =
    result.product === "clinic" ? siteConfig.clinic.url : siteConfig.lab.url;

  return (
    <div className="flex min-h-svh items-start justify-center sm:items-center">
      <CheckoutSuccessClient
        returnUrl={returnUrl}
        data={{
          transactionId: result.transactionId,
          product: result.product,
          email: result.email,
          customerName: result.customerName,
          orderKey: result.orderKey,
          activationKey: result.activationKey,
          hwid: result.hwid,
        }}
      />
    </div>
  );
}
