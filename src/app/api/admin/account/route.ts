import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  getSession,
  hashPassword,
  setAuthCookie,
  verifyPassword,
  writeAuditLog,
} from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.adminUser.findUnique({ where: { id: session.sub } });
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    user: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt,
    },
  });
}

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(10).max(128).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.adminUser.findUnique({ where: { id: session.sub } });
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  const updates: {
    name?: string;
    email?: string;
    passwordHash?: string;
    mustChangePassword?: boolean;
  } = {};

  if (data.name) updates.name = data.name.trim();
  if (data.email) {
    const email = data.email.toLowerCase().trim();
    const clash = await prisma.adminUser.findFirst({
      where: { email, NOT: { id: admin.id } },
    });
    if (clash) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    updates.email = email;
  }

  if (data.newPassword) {
    if (!data.currentPassword && !admin.mustChangePassword) {
      return NextResponse.json({ error: "Current password required" }, { status: 400 });
    }
    if (data.currentPassword) {
      const ok = await verifyPassword(data.currentPassword, admin.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Current password is wrong" }, { status: 400 });
      }
    }
    updates.passwordHash = await hashPassword(data.newPassword);
    updates.mustChangePassword = false;
  }

  const updated = await prisma.adminUser.update({
    where: { id: admin.id },
    data: updates,
  });

  const token = await createSessionToken({
    sub: updated.id,
    email: updated.email,
    name: updated.name,
    mustChangePassword: updated.mustChangePassword,
  });
  await setAuthCookie(token);
  await writeAuditLog({
    adminId: admin.id,
    action: data.newPassword ? "password_changed" : "profile_updated",
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      mustChangePassword: updated.mustChangePassword,
    },
  });
}
