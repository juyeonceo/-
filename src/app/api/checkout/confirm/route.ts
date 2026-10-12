import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerContext, fail, tossAuth } from "@/lib/server";

const schema = z.object({ paymentKey: z.string().min(1).max(200), orderId: z.string().min(6).max(64), amount: z.number().int().min(1) });

export async function POST(request: NextRequest) {
  const context = await customerContext(request); if (!context) return fail("로그인이 필요합니다.", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return fail("결제 정보가 올바르지 않습니다.");
  const { paymentKey, orderId, amount } = parsed.data;
  const { data: order } = await context.db.from("orders").select("id,user_id,status,total_amount,expires_at").eq("order_code", orderId).single();
  if (!order || order.user_id !== context.user.id) return fail("주문을 찾을 수 없습니다.", 404);
  if (order.total_amount !== amount) return fail("결제 금액이 일치하지 않습니다.");
  if (order.status !== "payment_pending") {
    const { data: payment } = await context.db.from("payments").select("payment_key").eq("order_id", order.id).maybeSingle();
    return payment?.payment_key === paymentKey ? NextResponse.json({ status: order.status }) : fail("이미 처리된 주문입니다.", 409);
  }
  if (new Date(order.expires_at).getTime() < Date.now()) return fail("결제 유효 시간이 지났습니다. 다시 주문해 주세요.", 409);
  const authorization = tossAuth(); if (!authorization) return fail("결제 서비스가 설정되지 않았습니다.", 503);
  const toss = await fetch("https://api.tosspayments.com/v1/payments/confirm", { method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json", "Idempotency-Key": order.id }, body: JSON.stringify({ paymentKey, orderId, amount }), cache: "no-store" });
  const payment = await toss.json();
  if (!toss.ok) return fail(payment.message || "결제 승인을 완료하지 못했습니다.", 502);
  const { data, error } = await context.db.rpc("confirm_checkout", { p_order_code: orderId, p_payment_key: paymentKey, p_response: payment });
  if (error) {
    console.error("Payment approved but DB finalization failed", orderId, error.message);
    const cancel = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, { method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json", "Idempotency-Key": order.id }, body: JSON.stringify({ cancelReason: "주문 기록 실패로 결제를 취소합니다." }), cache: "no-store" }).catch(() => null);
    if (cancel?.ok) await context.db.rpc("release_checkout", { p_order_code: orderId });
    return fail(cancel?.ok ? "주문 기록 오류로 결제를 취소했습니다. 다시 주문해 주세요." : "결제 확인에 문제가 발생했습니다. 고객센터에 주문번호를 알려주세요.", 500);
  }
  return NextResponse.json({ status: data });
}
