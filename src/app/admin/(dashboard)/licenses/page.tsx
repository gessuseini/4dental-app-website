"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { ProductBadge, StatusBadge } from "@/components/admin/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { Textarea } from "@/components/ui/textarea";
import { useRowSelection } from "@/hooks/use-row-selection";

type LicenseRow = {
  id: string;
  key: string;
  activationKey: string | null;
  product: string;
  status: string;
  hwid: string | null;
  userName: string | null;
  notes: string | null;
  createdAt: string;
  customer: { email: string; name: string | null } | null;
};

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [q, setQ] = useState("");
  const [product, setProduct] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    product: "clinic",
    email: "",
    name: "",
    notes: "",
    status: "active",
  });

  const ids = useMemo(() => licenses.map((l) => l.id), [licenses]);
  const selection = useRowSelection(ids);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (product !== "all") params.set("product", product);
    if (status !== "all") params.set("status", status);
    const res = await fetch(`/api/admin/licenses?${params}`);
    const data = await res.json();
    if (res.ok) setLicenses(data.licenses);
  }, [q, product, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLicense(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: form.product,
          email: form.email || undefined,
          name: form.name || undefined,
          notes: form.notes || undefined,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create");
        return;
      }
      toast.success(`Created ${data.license.key}`);
      setOpen(false);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/admin/licenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "revoked" }),
    });
    if (!res.ok) {
      toast.error("Could not revoke");
      return;
    }
    toast.success("License revoked");
    await load();
  }

  async function renew(id: string, _hasActivationKey: boolean) {
    const res = await fetch(`/api/admin/licenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "active",
      }),
    });
    if (!res.ok) {
      toast.error("Could not renew");
      return;
    }
    toast.success("License renewed — active again");
    await load();
  }

  function askDelete(idsToDelete: string[]) {
    if (idsToDelete.length === 0) return;
    setPendingDeleteIds(idsToDelete);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/licenses/bulk-delete", {
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
        data.deleted === 1 ? "License deleted" : `${data.deleted} licenses deleted`,
      );
      setDeleteOpen(false);
      setPendingDeleteIds([]);
      selection.clear();
      await load();
    } finally {
      setDeleting(false);
    }
  }

  async function clearDevice(id: string) {
    const res = await fetch(`/api/admin/licenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearHwid: true, status: "active" }),
    });
    if (!res.ok) {
      toast.error("Could not reset device binding");
      return;
    }
    toast.success("Device binding cleared — customer can activate on another computer");
    await load();
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    toast.success("Copied");
  }

  const deleteLabel =
    pendingDeleteIds.length === 1
      ? licenses.find((l) => l.id === pendingDeleteIds[0])?.key ?? "this license"
      : `${pendingDeleteIds.length} selected licenses`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Licenses</h1>
          <p className="text-sm text-muted-foreground">
            Issue, revoke, renew, and manage Clinic / Lab keys (email + 4DC/4DL). Reset device
            frees a bound computer so the customer can activate elsewhere.{" "}
            <a
              href="/pay/clinic"
              className="text-clinic underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Buy Clinic
            </a>
            {" · "}
            <a
              href="/pay/lab"
              className="text-lab underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Buy Lab
            </a>
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button>Create license</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create manual license</DialogTitle>
            </DialogHeader>
            <form onSubmit={createLicense}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Product</FieldLabel>
                  <Select
                    value={form.product}
                    onValueChange={(v) => setForm((f) => ({ ...f, product: v || "clinic" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinic">4Dental Clinic</SelectItem>
                      <SelectItem value="lab">4Dental Lab</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Customer email (optional)</FieldLabel>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>Name</FieldLabel>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>Notes</FieldLabel>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </Field>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create"}
                </Button>
              </FieldGroup>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All licenses</CardTitle>
          <CardDescription>Filter by product, status, or search. Select rows for bulk delete.</CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Input
              placeholder="Search key or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-xs"
            />
            <Select value={product} onValueChange={(v) => setProduct(v || "all")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="lab">Lab</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v || "all")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
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
                <TableHead>License key</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    No licenses found
                  </TableCell>
                </TableRow>
              ) : (
                licenses.map((l) => (
                  <TableRow key={l.id} data-selected={selection.isSelected(l.id) || undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selection.isSelected(l.id)}
                        onCheckedChange={(v) => selection.toggle(l.id, v === true)}
                        aria-label={`Select ${l.key}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <button
                        type="button"
                        className="block truncate font-mono text-xs hover:underline"
                        onClick={() => copyKey(l.key)}
                        title={l.key}
                      >
                        {l.key}
                      </button>
                      {l.customer?.email ? (
                        <p className="mt-1 truncate text-[10px] text-muted-foreground" title={l.customer.email}>
                          {l.customer.email}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <ProductBadge product={l.product} />
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm">
                      {l.customer?.name ?? l.userName ?? l.customer?.email ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[140px]">
                      {l.hwid ? (
                        <span className="block truncate font-mono text-[10px]" title={l.hwid}>
                          {l.hwid}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Not bound yet</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={l.status === "pending_hwid" ? "active" : l.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(l.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {l.hwid ? (
                          <Button size="xs" variant="outline" onClick={() => clearDevice(l.id)}>
                            Reset device
                          </Button>
                        ) : null}
                        {l.status === "revoked" || l.status === "expired" ? (
                          <Button size="xs" variant="default" onClick={() => renew(l.id, true)}>
                            Renew
                          </Button>
                        ) : (
                          <Button size="xs" variant="outline" onClick={() => revoke(l.id)}>
                            Revoke
                          </Button>
                        )}
                        <Button size="xs" variant="destructive" onClick={() => askDelete([l.id])}>
                          Delete
                        </Button>
                      </div>
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
        title={pendingDeleteIds.length > 1 ? "Delete licenses?" : "Delete license?"}
        description={`This permanently removes ${deleteLabel} from the hub. Desktop apps that already activated may keep working until their next server check. This cannot be undone.`}
        confirmLabel={
          pendingDeleteIds.length > 1
            ? `Delete ${pendingDeleteIds.length} licenses`
            : "Delete license"
        }
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
