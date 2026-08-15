import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  checkLoginRateLimit,
  createSessionToken,
  setAuthCookie,
  verifyPassword,
  writeAuditLog,
} from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkLoginRateLimit(`login:${ip}`);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) {
    await writeAuditLog({ action: "login_failed", meta: { email }, ip });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const ok = await verifyPassword(parsed.data.password, admin.passwordHash);
  if (!ok) {
    await writeAuditLog({
      adminId: admin.id,
      action: "login_failed",
      meta: { email },
      ip,
    });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  const token = await createSessionToken({
    sub: admin.id,
    email: admin.email,
    name: admin.name,
    mustChangePassword: admin.mustChangePassword,
  });
  await setAuthCookie(token);
  await writeAuditLog({ adminId: admin.id, action: "login_success", ip });

  return NextResponse.json({
    ok: true,
    mustChangePassword: admin.mustChangePassword,
    user: { email: admin.email, name: admin.name },
  });
}
