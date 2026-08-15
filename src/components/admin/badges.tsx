import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { productLabel } from "@/lib/products";

export function ProductBadge({
  product,
  className,
}: {
  product: string;
  className?: string;
}) {
  const isClinic = product === "clinic";
  return (
    <Badge
      variant="secondary"
      className={cn(
        isClinic
          ? "bg-clinic/15 text-clinic-dark hover:bg-clinic/20"
          : "bg-lab/15 text-lab-dark hover:bg-lab/20",
        className,
      )}
    >
      {productLabel(product)}
    </Badge>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending_hwid: "bg-clinic/15 text-clinic-dark",
  active: "bg-clinic/15 text-clinic-dark",
  trial: "bg-clinic-accent/15 text-clinic-accent",
  revoked: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
  completed: "bg-clinic/15 text-clinic-dark",
  paid: "bg-clinic/15 text-clinic-dark",
  billed: "bg-clinic-accent/15 text-clinic-accent",
  ready: "bg-muted text-foreground",
  drafted: "bg-muted text-muted-foreground",
  canceled: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  past_due: "bg-destructive/10 text-destructive",
  payment_failed: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
  declined: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<string, string> = {
  pending_hwid: "Ready",
  active: "Active",
  trial: "Trial",
  revoked: "Revoked",
  expired: "Expired",
  completed: "Completed",
  paid: "Paid",
  billed: "Billed",
  ready: "Ready",
  drafted: "Drafted",
  canceled: "Canceled",
  cancelled: "Cancelled",
  past_due: "Past due",
  payment_failed: "Payment failed",
  failed: "Failed",
  declined: "Declined",
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const label = STATUS_LABELS[key] ?? status.replace(/_/g, " ");
  return (
    <Badge
      variant="secondary"
      className={STATUS_STYLES[key] ?? "bg-muted text-muted-foreground"}
    >
      {label}
    </Badge>
  );
}

export function formatMoney(amount: string | null | undefined, currency: string | null | undefined) {
  if (!amount) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency ?? ""}`.trim();
  const code = (currency || "USD").toUpperCase();
  // Paddle Billing stores money in the lowest currency unit (e.g. cents).
  const major = n / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(major);
  } catch {
    return `${major.toFixed(2)} ${code}`;
  }
}
