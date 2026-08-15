import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, writeAuditLog } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Select at least one customer" }, { status: 400 });
  }

  const { ids } = parsed.data;

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.license.deleteMany({ where: { customerId: { in: ids } } });
    await tx.payment.deleteMany({ where: { customerId: { in: ids } } });
    const customers = await tx.customer.deleteMany({ where: { id: { in: ids } } });
    return customers.count;
  });

  await writeAuditLog({
    adminId: session.sub,
    action: "customers_bulk_deleted",
    meta: { ids, deleted },
  });

  return NextResponse.json({ ok: true, deleted });
}
