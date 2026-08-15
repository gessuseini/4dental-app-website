import Link from "next/link";
import { format, startOfDay, startOfMonth } from "date-fns";
import { redirect } from "next/navigation";
import { formatMoney, ProductBadge, StatusBadge } from "@/components/admin/badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const PAID = ["completed", "paid", "billed"] as const;

function sumMinor(rows: { amount: string | null }[]) {
  return rows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
}

function dominantCurrency(rows: { currency: string | null }[]) {
  return rows.find((r) => r.currency)?.currency || "EUR";
}

export default async function AdminOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const now = new Date();
  const dayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  const [
    paymentsToday,
    paymentsMonth,
    licensesActive,
    licensesTotal,
    customersTotal,
    recentPayments,
    recentLicenses,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: dayStart }, status: { in: [...PAID] } },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: monthStart }, status: { in: [...PAID] } },
    }),
    prisma.license.count({ where: { status: "active" } }),
    prisma.license.count(),
    prisma.customer.count(),
    prisma.payment.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
    prisma.license.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
  ]);

  const cards = [
    {
      label: "Sales today",
      value: formatMoney(String(sumMinor(paymentsToday)), dominantCurrency(paymentsToday)),
      hint: `${paymentsToday.length} payments`,
    },
    {
      label: "Sales this month",
      value: formatMoney(String(sumMinor(paymentsMonth)), dominantCurrency(paymentsMonth)),
      hint: `${paymentsMonth.length} payments`,
    },
    { label: "Active licenses", value: String(licensesActive), hint: `${licensesTotal} total` },
    { label: "Customers", value: String(customersTotal), hint: "All products" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {session.name}. Manage Clinic & Lab licenses from one hub.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="font-display text-2xl">{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent payments</CardTitle>
              <CardDescription>Latest Paddle transactions</CardDescription>
            </div>
            <Link href="/admin/payments" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No payments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  recentPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[160px] truncate">
                        {p.customer?.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ProductBadge product={p.product} />
                      </TableCell>
                      <TableCell>{formatMoney(p.amount, p.currency)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent licenses</CardTitle>
              <CardDescription>Issued keys</CardDescription>
            </div>
            <Link href="/admin/licenses" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLicenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No licenses yet
                    </TableCell>
                  </TableRow>
                ) : (
                  recentLicenses.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.key}</TableCell>
                      <TableCell>
                        <StatusBadge status={l.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(l.createdAt, "MMM d, yyyy")}
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
