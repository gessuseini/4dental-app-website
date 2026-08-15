import { NextRequest } from "next/server";
import { getPaddleServer } from "@/lib/paddle/server";
import { processPaddleEvent } from "@/lib/paddle/process-webhook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET ?? "";

  if (!signature || !rawBody || !secret) {
    return Response.json(
      { error: "Missing signature, body, or webhook secret" },
      { status: 400 },
    );
  }

  try {
    const paddle = getPaddleServer();
    const eventData = await paddle.webhooks.unmarshal(rawBody, secret, signature);
    if (eventData) {
      await processPaddleEvent(eventData);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("[paddle] webhook error:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
