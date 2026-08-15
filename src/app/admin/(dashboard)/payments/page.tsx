"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { formatMoney, ProductBadge, StatusBadge } from "@/components/admin/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRowSelection } from "@/hooks/use-row-selection";

type PaymentRow = {
  id: string;
  paddleTransactionId: string;
  product: string;
  amount: string | null;
  currency: string | null;
  status: string;
  lastEventType: string | null;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  failureReason: string | null;
  invoiceNumber: string | null;
  createdAt: string;
  customer: { id: string; email: string; name: string | null } | null;
  licenses: { key: string }[];
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [q, setQ] = useState("");
  const [product, setProduct] = useState("all");
  const [status, setStatus] = useState("all");
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const ids = useMemo(() => payments.map((p) => p.id), [payments]);
  const selection = useRowSelection(ids);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (product !== "all") params.set("product", product);
    if (status !== "all") params.set("status", status);
    const res = await fetch(`/api/admin/payments?${params}`);
    const data = await res.json();
    if (res.ok) setPayments(data.payments);
  }, [q, product, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function askDelete(idsToDelete: string[]) {
    if (idsToDelete.length === 0) return;
    setPendingDeleteIds(idsToDelete);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/payments/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingDeleteIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not delete");
        return;
      }
      toast.success(
        data.deleted === 1 ? "Payment deleted" : `${data.deleted} payments deleted`,
      );
      setDeleteOpen(false);
      setPendingDeleteIds([]);
      selection.clear();
      await load();
    } finally {
      setDeleting(false);
    }
  }

  const deleteLabel =
    pendingDeleteIds.length === 1
      ? payments.find((p) => p.id === pendingDeleteIds[0])?.paddleTransactionId ??
        "this payment"
      : `${pendingDeleteIds.length} selected payments`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Payments appear automatically after checkout. Filter, select, and delete hub records
          (does not refund in Paddle).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>Filter by status, product, or search txn / email / invoice.</CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Input
              placeholder="Search txn, email, invoice…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-xs"
            />
            <Select value={product} onValueChange={(v) => setProduct(v || "all")}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="lab">Lab</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v || "all")}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="billed">Billed</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="drafted">Drafted</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="past_due">Past due</SelectItem>
                <SelectItem value="payment_failed">Payment failed</SelectItem>
              </SelectContent>
            </Select>
            {selection.count > 0 ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => askDelete(selection.selectedIds)}
              >
                Delete selected ({selection.count})
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selection.allSelected}
                    onCheckedChange={(v) => selection.toggleAll(v === true)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground">
                    No payments yet — complete a sandbox checkout or wait for Paddle webhooks.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={selection.isSelected(p.id)}
                        onCheckedChange={(v) => selection.toggle(p.id, v === true)}
                        aria-label={`Select ${p.paddleTransactionId}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      <Link
                        href={`/admin/payments/${p.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {p.paddleTransactionId}
                      </Link>
                      {p.failureReason ? (
                        <p className="mt-0.5 truncate text-[11px] text-destructive">
                          {p.failureReason}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate">
                      {p.customer ? (
                        <Link
                          href={`/admin/customers/${p.customer.id}`}
                          className="hover:underline"
                        >
                          {p.customer.email}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <ProductBadge product={p.product} />
                    </TableCell>
                    <TableCell>{formatMoney(p.amount, p.currency)}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.paymentMethod
                        ? `${p.paymentMethod}${p.cardBrand ? ` · ${p.cardBrand}` : ""}${
                            p.cardLast4 ? ` ••${p.cardLast4}` : ""
                          }`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.licenses[0]?.key ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(p.createdAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => askDelete([p.id])}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={pendingDeleteIds.length > 1 ? "Delete payments?" : "Delete payment?"}
        description={`This permanently removes ${deleteLabel} from the hub, including linked licenses. It does not refund or cancel anything in Paddle.`}
        confirmLabel={
          pendingDeleteIds.length > 1
            ? `Delete ${pendingDeleteIds.length} payments`
            : "Delete payment"
        }
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
