import { NextResponse } from "next/server";
import { startOfDay, startOfMonth } from "date-fns";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      where: { createdAt: { gte: dayStart }, status: { in: ["completed", "paid"] } },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: monthStart }, status: { in: ["completed", "paid"] } },
    }),
    prisma.license.count({ where: { status: "active" } }),
    prisma.license.count(),
    prisma.customer.count(),
    prisma.payment.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
    prisma.license.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
  ]);

  const sumAmounts = (rows: { amount: string | null }[]) =>
    rows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);

  // Paddle stores amounts in minor units (cents). Expose both for clients that format.
  return NextResponse.json({
    stats: {
      salesTodayMinor: sumAmounts(paymentsToday),
      salesMonthMinor: sumAmounts(paymentsMonth),
      salesToday: sumAmounts(paymentsToday) / 100,
      salesMonth: sumAmounts(paymentsMonth) / 100,
      currency: paymentsMonth.find((p) => p.currency)?.currency || "EUR",
      paymentsTodayCount: paymentsToday.length,
      paymentsMonthCount: paymentsMonth.length,
      licensesActive,
      licensesTotal,
      customersTotal,
    },
    recentPayments,
    recentLicenses,
  });
}
