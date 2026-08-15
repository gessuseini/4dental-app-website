"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RateLimitContinue({
  txn,
  intentId,
}: {
  txn: string;
  intentId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"clinic" | "lab" | null>(null);

  async function continueAs(product: "clinic" | "lab") {
    setLoading(product);
    try {
      const res = await fetch("/api/checkout/fulfill-offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txn, product, intentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not continue");
        return;
      }
      toast.success("Payment saved — continue activation");
      router.push(`/checkout/success?txn=${encodeURIComponent(txn)}&product=${product}`);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Your Paddle checkout already finished. Because the sandbox API is blocked, finish here
        without calling Paddle again:
      </p>
      <Button
        size="lg"
        disabled={loading !== null}
        onClick={() => continueAs("clinic")}
      >
        {loading === "clinic" ? "Saving…" : "Continue — I bought Clinic"}
      </Button>
      <Button
        size="lg"
        variant="outline"
        disabled={loading !== null}
        onClick={() => continueAs("lab")}
      >
        {loading === "lab" ? "Saving…" : "Continue — I bought Lab"}
      </Button>
    </div>
  );
}
