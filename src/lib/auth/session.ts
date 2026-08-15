import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  AUTH_COOKIE,
  SESSION_DAYS,
  createSessionToken,
  type SessionPayload,
  verifySessionToken,
} from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";

export {
  AUTH_COOKIE,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/jwt";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function setAuthCookie(token: string) {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function getAdminFromSession() {
  const session = await getSession();
  if (!session) return null;
  return prisma.adminUser.findUnique({ where: { id: session.sub } });
}

export async function writeAuditLog(input: {
  adminId?: string | null;
  action: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      adminId: input.adminId ?? null,
      action: input.action,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      ip: input.ip ?? null,
    },
  });
}

/** Simple in-memory login rate limit (per process). */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(key: string, limit = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const };
  }
  if (entry.count >= limit) {
    return { ok: false as const, retryAfterMs: entry.resetAt - now };
  }
  entry.count += 1;
  return { ok: true as const };
}
