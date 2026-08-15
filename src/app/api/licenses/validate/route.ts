import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  key: z.string().min(8),
  hwid: z.string().min(4).max(256).optional(),
});

function authorize(request: NextRequest) {
  const secret = process.env.LICENSE_API_SECRET;
  if (!secret) return true;
  const header = request.headers.get("x-license-secret") || request.headers.get("authorization");
  if (!header) return false;
  if (header === secret) return true;
  if (header === `Bearer ${secret}`) return true;
  return false;
}

async function findLicenseByKey(rawKey: string) {
  const key = rawKey.trim();
  // Desktop activation keys are base64url.hmac — look up activationKey first
  const byActivation = await prisma.license.findFirst({
    where: { activationKey: key },
  });
  if (byActivation) return byActivation;

  return prisma.license.findFirst({
    where: {
      OR: [{ key }, { key: key.toUpperCase() }],
    },
  });
}

/**
 * Desktop apps call this on launch / activate.
 * Revoked or expired licenses return valid:false so the app can clear the registry.
 */
export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", valid: false }, { status: 400 });
  }

  const license = await findLicenseByKey(parsed.data.key);

  if (!license) {
    // Unknown key — may be an old manually issued key never stored in hub.
    // Return "unknown" so apps can keep local crypto validation (fail-open for legacy).
    return NextResponse.json({
      valid: true,
      status: "unknown",
      legacy: true,
    });
  }

  if (license.status === "revoked") {
    return NextResponse.json({
      valid: false,
      status: "revoked",
      error: "License has been revoked. Contact support.",
    });
  }

  if (license.status === "expired") {
    return NextResponse.json({
      valid: false,
      status: "expired",
      error: "License has expired.",
    });
  }

  if (license.status !== "active" && license.status !== "trial") {
    return NextResponse.json({
      valid: false,
      status: license.status,
      error: `License status is ${license.status}`,
    });
  }

  if (license.expiresAt && license.expiresAt < new Date()) {
    await prisma.license.update({
      where: { id: license.id },
      data: { status: "expired" },
    });
    return NextResponse.json({
      valid: false,
      status: "expired",
      error: "License has expired.",
    });
  }

  if (parsed.data.hwid && license.hwid && license.hwid !== parsed.data.hwid) {
    return NextResponse.json({
      valid: false,
      status: "hwid_mismatch",
      error: "License is for a different computer",
    });
  }

  return NextResponse.json({
    valid: true,
    product: license.product,
    status: license.status,
    expiresAt: license.expiresAt,
  });
}
