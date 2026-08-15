"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadUrlForProduct } from "@/lib/site";
import { productLabel, type ProductSlug } from "@/lib/products";

export type SuccessCheckoutData = {
  transactionId: string;
  product: ProductSlug;
  email: string | null;
  customerName: string | null;
  orderKey: string | null;
  activationKey: string | null;
  hwid: string | null;
};

const btnClass =
  "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90";
const btnOutline =
  "inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted";

export function CheckoutSuccessClient({
  data,
  returnUrl,
}: {
  data: SuccessCheckoutData;
  returnUrl: string;
}) {
  const downloadUrl = downloadUrlForProduct(data.product);
  const label = productLabel(data.product);
  const licenseKey = data.orderKey || data.activationKey;

  async function copy(text: string, okMsg: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success(okMsg);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Payment successful</CardTitle>
          <CardDescription>
            Thank you for purchasing {label}.
            {data.email ? ` Receipt sent to ${data.email}.` : null} Your license key is ready —
            download the app and activate with your email + key.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 text-sm">
          {licenseKey ? (
            <div className="rounded-lg border border-clinic/30 bg-clinic/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your license key
              </p>
              <p className="mt-2 break-all font-mono text-sm font-semibold tracking-wide">
                {licenseKey}
              </p>
              {data.email ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Email to use in the app:{" "}
                  <span className="font-medium text-foreground">{data.email}</span>
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" onClick={() => copy(licenseKey, "License key copied")}>
                  Copy license key
                </Button>
                {data.email ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copy(data.email!, "Email copied")}
                  >
                    Copy email
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              License key is still being prepared. Refresh this page in a few seconds.
            </p>
          )}

          <ol className="flex list-decimal flex-col gap-3 pl-5 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Download and install {label}</span>
              <div className="mt-2">
                <a href={downloadUrl} className={btnClass} download>
                  Download {label}
                </a>
              </div>
            </li>
            <li>
              <span className="font-medium text-foreground">Open the program</span>
              <p className="mt-1">
                On first launch you will see the license screen (not a Hardware ID).
              </p>
            </li>
            <li>
              <span className="font-medium text-foreground">Enter your email and license key</span>
              <p className="mt-1">
                Use the same email from checkout
                {data.email ? (
                  <>
                    {" "}
                    (<span className="font-mono text-foreground">{data.email}</span>
                  </>
                ) : null}{" "}
                and paste the key above (starts with{" "}
                {data.product === "lab" ? "4DL-" : "4DC-"}).
              </p>
            </li>
            <li>
              <span className="font-medium text-foreground">Stay online for activation</span>
              <p className="mt-1">
                The app verifies your license with 4dental.app. After that you can work offline;
                it will ask you to reconnect when a periodic check is due.
              </p>
            </li>
          </ol>

          <div className="flex flex-wrap gap-2">
            <Link href={returnUrl} className={btnOutline}>
              Back to product site
            </Link>
            <Link href="/" className={btnOutline}>
              4Dental.app
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
