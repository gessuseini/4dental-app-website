import { NextResponse } from "next/server";
import { clearAuthCookie, getSession, writeAuditLog } from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  if (session) {
    await writeAuditLog({ adminId: session.sub, action: "logout" });
  }
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
