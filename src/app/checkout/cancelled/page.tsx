import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Payment cancelled — 4Dental",
  robots: { index: false, follow: false },
};

const btnClass =
  "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90";
const btnOutline =
  "inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted";
const btnGhost =
  "inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground";

export default function CheckoutCancelledPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Payment cancelled</CardTitle>
          <CardDescription>
            No charge was completed. You can return to the product site or try checkout again.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/pay/clinic" className={btnClass}>
            Buy Clinic
          </Link>
          <Link href="/pay/lab" className={btnOutline}>
            Buy Lab
          </Link>
          <Link href="/" className={btnGhost}>
            Home
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
