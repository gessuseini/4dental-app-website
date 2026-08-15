import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isProductSlug } from "@/lib/products";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const product = searchParams.get("product");
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();

  const payments = await prisma.payment.findMany({
    where: {
      ...(product && isProductSlug(product) ? { product } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { paddleTransactionId: { contains: q } },
              { invoiceNumber: { contains: q } },
              { failureReason: { contains: q } },
              { customer: { email: { contains: q } } },
              { customer: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { customer: true, licenses: true },
  });

  return NextResponse.json({ payments });
}
