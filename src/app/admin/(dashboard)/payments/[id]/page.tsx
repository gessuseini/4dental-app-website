"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatMoney, ProductBadge, StatusBadge } from "@/components/admin/badges";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PaymentDetail = {
  id: string;
  paddleTransactionId: string;
  product: string;
  amount: string | null;
  currency: string | null;
  status: string;
  lastEventType: string | null;
  collectionMode: string | null;
  origin: string | null;
  invoiceNumber: string | null;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  failureCode: string | null;
  failureReason: string | null;
  customerCountry: string | null;
  tax: string | null;
  subtotal: string | null;
  discount: string | null;
  earnings: string | null;
  billedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rawJson: string | null;
  customer: {
    id: string;
    email: string;
    name: string | null;
    paddleCustomerId: string | null;
    country: string | null;
  } | null;
  licenses: { id: string; key: string; status: string }[];
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-border/60 py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value || "—"}</dd>
    </div>
  );
}

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/payments/${params.id}`);
    const data = await res.json();
    if (res.ok) setPayment(data.payment);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncFromPaddle() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/admin/payments/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sync failed");
        return;
      }
      setPayment(data.payment);
      toast.success("Synced from Paddle");
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  if (!payment) {
    return <p className="text-sm text-muted-foreground">Loading payment…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/payments" className="text-sm text-muted-foreground hover:text-foreground">
            ← Payments
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Payment detail</h1>
          <p className="font-mono text-xs text-muted-foreground">{payment.paddleTransactionId}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={payment.status} />
          <ProductBadge product={payment.product} />
          <Button variant="outline" size="sm" onClick={syncFromPaddle} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync from Paddle"}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete payment?"
        description={`This permanently removes ${payment.paddleTransactionId} from the hub, including linked licenses. It does not refund in Paddle.`}
        confirmLabel="Delete payment"
        loading={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            const res = await fetch(`/api/admin/payments/${payment.id}`, { method: "DELETE" });
            if (!res.ok) {
              toast.error("Could not delete");
              return;
            }
            toast.success("Payment deleted");
            setDeleteOpen(false);
            router.push("/admin/payments");
          } finally {
            setDeleting(false);
          }
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transaction</CardTitle>
            <CardDescription>Status and amounts from Paddle</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Status" value={<StatusBadge status={payment.status} />} />
              <Row label="Amount" value={formatMoney(payment.amount, payment.currency)} />
              <Row label="Subtotal" value={formatMoney(payment.subtotal, payment.currency)} />
              <Row label="Tax" value={formatMoney(payment.tax, payment.currency)} />
              <Row label="Discount" value={formatMoney(payment.discount, payment.currency)} />
              <Row label="Earnings" value={formatMoney(payment.earnings, payment.currency)} />
              <Row label="Invoice" value={payment.invoiceNumber} />
              <Row label="Collection" value={payment.collectionMode} />
              <Row label="Origin" value={payment.origin} />
              <Row label="Last event" value={payment.lastEventType} />
              <Row
                label="Billed at"
                value={
                  payment.billedAt ? format(new Date(payment.billedAt), "MMM d, yyyy HH:mm") : null
                }
              />
              <Row
                label="Updated"
                value={format(new Date(payment.updatedAt), "MMM d, yyyy HH:mm")}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer & method</CardTitle>
            <CardDescription>Buyer and payment attempt details</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <Row
                label="Email"
                value={
                  payment.customer ? (
                    <Link
                      href={`/admin/customers/${payment.customer.id}`}
                      className="text-primary hover:underline"
                    >
                      {payment.customer.email}
                    </Link>
                  ) : null
                }
              />
              <Row label="Name" value={payment.customer?.name} />
              <Row label="Paddle customer" value={payment.customer?.paddleCustomerId} />
              <Row label="Country" value={payment.customerCountry || payment.customer?.country} />
              <Row label="Method" value={payment.paymentMethod} />
              <Row
                label="Card"
                value={
                  payment.cardBrand || payment.cardLast4
                    ? `${payment.cardBrand ?? "card"} ••${payment.cardLast4 ?? "----"}`
                    : null
                }
              />
              <Row label="Failure code" value={payment.failureCode} />
              <Row label="Failure reason" value={payment.failureReason} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Licenses linked</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payment.licenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    No license yet (issued when payment completes)
                  </TableCell>
                </TableRow>
              ) : (
                payment.licenses.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.key}</TableCell>
                    <TableCell>
                      <StatusBadge status={l.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
