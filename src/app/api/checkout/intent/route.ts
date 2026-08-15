import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutIntent } from "@/lib/paddle/offline-fulfill";

const schema = z.object({
  product: z.enum(["clinic", "lab"]),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }
  const intent = await createCheckoutIntent(parsed.data.product);
  return NextResponse.json({ intentId: intent.id, product: intent.product });
}
