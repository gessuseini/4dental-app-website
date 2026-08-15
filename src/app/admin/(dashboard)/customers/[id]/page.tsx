import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { formatMoney, ProductBadge, StatusBadge } from "@/components/admin/badges";
import { DeleteCustomerButton } from "@/components/admin/delete-customer-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      licenses: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) notFound();

  const paidCount = customer.payments.filter((p) =>
    ["completed", "paid"].includes(p.status),
  ).length;
  const failedCount = customer.payments.filter((p) =>
    ["canceled", "payment_failed", "past_due"].includes(p.status),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/customers" className="text-sm text-muted-foreground hover:text-foreground">
            ← Customers
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{customer.email}</h1>
          <p className="text-sm text-muted-foreground">{customer.name ?? "No name on file"}</p>
        </div>
        <DeleteCustomerButton id={customer.id} email={customer.email} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paddle customer</CardDescription>
            <CardTitle className="font-mono text-sm">
              {customer.paddleCustomerId ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Country / locale</CardDescription>
            <CardTitle className="text-base">
              {[customer.country, customer.locale].filter(Boolean).join(" · ") || "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid / completed</CardDescription>
            <CardTitle className="text-2xl">{paidCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed / canceled</CardDescription>
            <CardTitle className="text-2xl">{failedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Licenses</CardTitle>
            <CardDescription>{customer.licenses.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.licenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No licenses
                    </TableCell>
                  </TableRow>
                ) : (
                  customer.licenses.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.key}</TableCell>
                      <TableCell>
                        <ProductBadge product={l.product} />
                      </TableCell>
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

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>{customer.payments.length} total — all Paddle statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Txn</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No payments
                    </TableCell>
                  </TableRow>
                ) : (
                  customer.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[120px] truncate font-mono text-xs">
                        <Link
                          href={`/admin/payments/${p.id}`}
                          className="text-primary hover:underline"
                        >
                          {p.paddleTransactionId}
                        </Link>
                      </TableCell>
                      <TableCell>{formatMoney(p.amount, p.currency)}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(p.createdAt, "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
