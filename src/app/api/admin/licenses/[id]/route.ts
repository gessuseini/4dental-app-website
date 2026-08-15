import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, writeAuditLog } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const license = await prisma.license.findUnique({
    where: { id },
    include: { customer: true, payment: true },
  });
  if (!license) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ license });
}

const patchSchema = z.object({
  status: z.enum(["active", "trial", "revoked", "expired", "pending_hwid"]).optional(),
  notes: z.string().optional().nullable(),
  clearHwid: z.boolean().optional(),
  hwid: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  const license = await prisma.license.update({
    where: { id },
    data: {
      status: data.status,
      notes: data.notes === undefined ? undefined : data.notes,
      hwid: data.clearHwid ? null : data.hwid === undefined ? undefined : data.hwid,
      activationKey: data.clearHwid ? null : undefined,
      activatedAt: data.clearHwid ? null : undefined,
    },
    include: { customer: true, payment: true },
  });

  await writeAuditLog({
    adminId: session.sub,
    action:
      data.status === "revoked"
        ? "license_revoked"
        : data.status === "active" || data.status === "pending_hwid"
          ? "license_renewed"
          : "license_updated",
    meta: { licenseId: license.id, status: license.status },
  });

  return NextResponse.json({ license });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.license.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.license.delete({ where: { id } });

  await writeAuditLog({
    adminId: session.sub,
    action: "license_deleted",
    meta: { licenseId: id, key: existing.key, product: existing.product },
  });

  return NextResponse.json({ ok: true });
}
