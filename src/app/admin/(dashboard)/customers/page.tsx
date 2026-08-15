"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
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

type CustomerRow = {
  id: string;
  email: string;
  name: string | null;
  paddleCustomerId: string | null;
  country: string | null;
  createdAt: string;
  _count: { licenses: number; payments: number };
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("all");
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/customers?${params}`);
    const data = await res.json();
    if (res.ok) setCustomers(data.customers);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      if (c.country) set.add(c.country);
    }
    return Array.from(set).sort();
  }, [customers]);

  const visible = useMemo(() => {
    if (country === "all") return customers;
    if (country === "none") return customers.filter((c) => !c.country);
    return customers.filter((c) => c.country === country);
  }, [customers, country]);

  const visibleIds = useMemo(() => visible.map((c) => c.id), [visible]);
  const selection = useRowSelection(visibleIds);

  function askDelete(idsToDelete: string[]) {
    if (idsToDelete.length === 0) return;
    setPendingDeleteIds(idsToDelete);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/customers/bulk-delete", {
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
        data.deleted === 1 ? "Customer deleted" : `${data.deleted} customers deleted`,
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
      ? customers.find((c) => c.id === pendingDeleteIds[0])?.email ?? "this customer"
      : `${pendingDeleteIds.length} selected customers`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Buyers synced from Paddle. Search, filter, select, and delete hub records.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>Search by email or name. Select rows for bulk delete.</CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Input
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-xs"
            />
            <Select value={country} onValueChange={(v) => setCountry(v || "all")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                <SelectItem value="none">No country</SelectItem>
                {countries.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
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
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Paddle ID</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Licenses</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    No customers yet
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Checkbox
                        checked={selection.isSelected(c.id)}
                        onCheckedChange={(v) => selection.toggle(c.id, v === true)}
                        aria-label={`Select ${c.email}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="text-primary hover:underline"
                      >
                        {c.email}
                      </Link>
                    </TableCell>
                    <TableCell>{c.name ?? "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate font-mono text-xs">
                      {c.paddleCustomerId ?? "—"}
                    </TableCell>
                    <TableCell>{c.country ?? "—"}</TableCell>
                    <TableCell>{c._count.licenses}</TableCell>
                    <TableCell>{c._count.payments}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(c.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="xs" variant="destructive" onClick={() => askDelete([c.id])}>
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
        title={pendingDeleteIds.length > 1 ? "Delete customers?" : "Delete customer?"}
        description={`This permanently removes ${deleteLabel} from the hub, including their payments and licenses. It does not refund in Paddle.`}
        confirmLabel={
          pendingDeleteIds.length > 1
            ? `Delete ${pendingDeleteIds.length} customers`
            : "Delete customer"
        }
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
