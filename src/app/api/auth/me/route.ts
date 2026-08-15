import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: session.sub,
      email: session.email,
      name: session.name,
      mustChangePassword: session.mustChangePassword,
    },
  });
}
