import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import { tossAuth } from "@/lib/server";

export async function POST(request: NextRequest) {
  const db = getAdminSupabase(); const authorization = tossAuth();
  if (!db || !authorization) return NextResponse.json({ error: "integration unavailable" }, { status: 503 });
  const event = await request.json().catch(() => null);
  const paymentKey = event?.data?.paymentKey;
  if (typeof paymentKey !== "string") return NextResponse.json({ received: true });
  // General Toss webhooks are not signed; always fetch the canonical payment state.
  const response = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, { headers: { Authorization: authorization }, cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "verification failed" }, { status: 502 });
  const payment = await response.json();
  if (payment.status !== "DONE" || typeof payment.orderId !== "string") return NextResponse.json({ received: true });
  const { data: order } = await db.from("orders").select("id,status,total_amount").eq("order_code", payment.orderId).maybeSingle();
  if (!order || order.total_amount !== payment.totalAmount) return NextResponse.json({ error: "order mismatch" }, { status: 409 });
  if (order.status === "payment_pending") {
    const { error } = await db.rpc("confirm_checkout", { p_order_code: payment.orderId, p_payment_key: paymentKey, p_response: payment });
    if (error) { console.error("Webhook order finalization failed", payment.orderId, error.message); return NextResponse.json({ error: "finalization failed" }, { status: 500 }); }
  }
  return NextResponse.json({ received: true });
}
