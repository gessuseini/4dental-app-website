import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  key: z.string().min(8),
  hwid: z.string().min(4).max(256),
});

function authorize(request: NextRequest) {
  const secret = process.env.LICENSE_API_SECRET;
  if (!secret) return true; // allow in local/dev if unset
  const header = request.headers.get("x-license-secret") || request.headers.get("authorization");
  if (!header) return false;
  if (header === secret) return true;
  if (header === `Bearer ${secret}`) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const license = await prisma.license.findUnique({
    where: { key: parsed.data.key.trim().toUpperCase() },
    include: { customer: true },
  });

  if (!license) {
    return NextResponse.json({ error: "License not found", valid: false }, { status: 404 });
  }
  if (license.status !== "active" && license.status !== "trial") {
    return NextResponse.json(
      { error: "License is not active", valid: false, status: license.status },
      { status: 403 },
    );
  }
  if (license.expiresAt && license.expiresAt < new Date()) {
    await prisma.license.update({
      where: { id: license.id },
      data: { status: "expired" },
    });
    return NextResponse.json({ error: "License expired", valid: false }, { status: 403 });
  }

  if (license.hwid && license.hwid !== parsed.data.hwid) {
    return NextResponse.json(
      { error: "License already activated on another device", valid: false },
      { status: 409 },
    );
  }

  const updated = await prisma.license.update({
    where: { id: license.id },
    data: {
      hwid: parsed.data.hwid,
      activatedAt: license.activatedAt ?? new Date(),
    },
  });

  return NextResponse.json({
    valid: true,
    product: updated.product,
    status: updated.status,
    activatedAt: updated.activatedAt,
    expiresAt: updated.expiresAt,
  });
}
