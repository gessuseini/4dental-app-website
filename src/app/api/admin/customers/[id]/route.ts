import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAuditLog } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      licenses: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ customer });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { licenses: true, payments: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.license.deleteMany({ where: { customerId: id } }),
    prisma.payment.deleteMany({ where: { customerId: id } }),
    prisma.customer.delete({ where: { id } }),
  ]);

  await writeAuditLog({
    adminId: session.sub,
    action: "customer_deleted",
    meta: {
      customerId: id,
      email: existing.email,
      licenses: existing._count.licenses,
      payments: existing._count.payments,
    },
  });

  return NextResponse.json({ ok: true });
}
