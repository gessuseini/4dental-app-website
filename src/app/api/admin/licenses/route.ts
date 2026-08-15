import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, writeAuditLog } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { generateLicenseKey } from "@/lib/licenses/keys";
import { isProductSlug } from "@/lib/products";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const product = searchParams.get("product");
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();

  const licenses = await prisma.license.findMany({
    where: {
      ...(product && isProductSlug(product) ? { product } : {}),
      ...(status === "active"
        ? { status: { in: ["active", "pending_hwid"] } }
        : status
          ? { status }
          : {}),
      ...(q
        ? {
            OR: [
              { key: { contains: q } },
              { customer: { email: { contains: q } } },
              { customer: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { customer: true, payment: true },
  });

  // Legacy "pending_hwid" rows are ready keys (email + 4DC/4DL) — show as active.
  const pendingIds = licenses.filter((l) => l.status === "pending_hwid").map((l) => l.id);
  if (pendingIds.length > 0) {
    await prisma.license.updateMany({
      where: { id: { in: pendingIds } },
      data: { status: "active" },
    });
  }

  return NextResponse.json({
    licenses: licenses.map((l) =>
      l.status === "pending_hwid" ? { ...l, status: "active" } : l,
    ),
  });
}

const createSchema = z.object({
  product: z.enum(["clinic", "lab"]),
  email: z.string().email().optional(),
  name: z.string().optional(),
  status: z.enum(["active", "trial", "revoked", "expired"]).default("active"),
  notes: z.string().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  let customerId: string | undefined;
  if (data.email) {
    const customer = await prisma.customer.upsert({
      where: { email: data.email.toLowerCase() },
      update: { name: data.name },
      create: { email: data.email.toLowerCase(), name: data.name },
    });
    customerId = customer.id;
  }

  const key = generateLicenseKey(data.product);
  const license = await prisma.license.create({
    data: {
      key,
      product: data.product,
      status: data.status,
      customerId,
      notes: data.notes,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
    include: { customer: true },
  });

  await writeAuditLog({
    adminId: session.sub,
    action: "license_created",
    meta: { licenseId: license.id, key: license.key, product: license.product },
  });

  return NextResponse.json({ license }, { status: 201 });
}
