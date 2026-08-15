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
    return NextResponse.json({ error: "Select at least one license" }, { status: 400 });
  }

  const { ids } = parsed.data;
  const result = await prisma.license.deleteMany({ where: { id: { in: ids } } });

  await writeAuditLog({
    adminId: session.sub,
    action: "licenses_bulk_deleted",
    meta: { ids, deleted: result.count },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
