import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isProductSlug } from "@/lib/products";

export const runtime = "nodejs";

/**
 * TESTING: require online check on every desktop launch.
 * Later set LICENSE_LEASE_DAYS=14 (or 30) for offline grace.
 */
function leaseMs() {
  const days = Number(process.env.LICENSE_LEASE_DAYS || "0");
  if (!Number.isFinite(days) || days <= 0) return 0; // 0 = must revalidate every launch
  return days * 24 * 60 * 60 * 1000;
}

const schema = z.object({
  email: z.string().email(),
  key: z.string().min(8).max(64),
  product: z.enum(["clinic", "lab"]),
  hwid: z.string().min(4).max(256).optional(),
});

function normalizeKey(key: string) {
  return key.trim().toUpperCase().replace(/\s+/g, "");
}

async function findLicense(rawKey: string, product: string) {
  const key = normalizeKey(rawKey);
  return prisma.license.findFirst({
    where: {
      product,
      OR: [{ key }, { key: rawKey.trim() }, { activationKey: rawKey.trim() }],
    },
    include: { customer: true },
  });
}

/**
 * Desktop apps call this to activate or re-validate email + 4DC/4DL key.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { valid: false, error: "Enter a valid email and license key." },
      { status: 400 },
    );
  }

  const { email, product, hwid } = parsed.data;
  if (!isProductSlug(product)) {
    return NextResponse.json({ valid: false, error: "Invalid product." }, { status: 400 });
  }

  const license = await findLicense(parsed.data.key, product);
  if (!license) {
    return NextResponse.json(
      { valid: false, error: "License key not found for this product." },
      { status: 404 },
    );
  }

  const customerEmail = license.customer?.email?.toLowerCase() ?? "";
  if (!customerEmail || customerEmail !== email.trim().toLowerCase()) {
    return NextResponse.json(
      {
        valid: false,
        error: "Email does not match this license. Use the email from your purchase receipt.",
      },
      { status: 403 },
    );
  }

  if (license.status === "revoked") {
    return NextResponse.json(
      { valid: false, status: "revoked", error: "License has been revoked. Contact support." },
      { status: 403 },
    );
  }

  if (license.status === "expired") {
    return NextResponse.json(
      { valid: false, status: "expired", error: "License has expired." },
      { status: 403 },
    );
  }

  if (license.expiresAt && license.expiresAt < new Date()) {
    await prisma.license.update({
      where: { id: license.id },
      data: { status: "expired" },
    });
    return NextResponse.json(
      { valid: false, status: "expired", error: "License has expired." },
      { status: 403 },
    );
  }

  // Soft HWID bind: first machine wins; mismatch blocked unless cleared in admin
  if (hwid && license.hwid && license.hwid !== hwid) {
    return NextResponse.json(
      {
        valid: false,
        status: "hwid_mismatch",
        error: "This license is already activated on another computer. Contact support to reset.",
      },
      { status: 409 },
    );
  }

  const ms = leaseMs();
  const leaseUntil = ms > 0 ? new Date(Date.now() + ms) : null;

  const updated = await prisma.license.update({
    where: { id: license.id },
    data: {
      status: "active",
      userName: license.userName || license.customer?.name || undefined,
      hwid: license.hwid || hwid || undefined,
      activatedAt: license.activatedAt ?? new Date(),
      // Keep order key as the customer-facing key; clear old HMAC blobs if any
      activationKey: null,
    },
    include: { customer: true },
  });

  return NextResponse.json({
    valid: true,
    status: updated.status,
    product: updated.product,
    key: updated.key,
    email: updated.customer?.email ?? email.trim().toLowerCase(),
    leaseUntil: leaseUntil?.toISOString() ?? null,
    requireOnlineEveryLaunch: ms <= 0,
    customerName: updated.customer?.name ?? updated.userName,
  });
}
