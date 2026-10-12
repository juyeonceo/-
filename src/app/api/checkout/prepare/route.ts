import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerContext, fail } from "@/lib/server";
import { isDemo } from "@/lib/supabase";

const schema = z.object({
  items: z.array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(99) })).min(1).max(50),
  address: z.object({ recipient: z.string().min(1).max(80), phone: z.string().min(8).max(30), postalCode: z.string().min(3).max(20), address: z.string().min(5).max(250), detail: z.string().max(250) }),
  couponCode: z.string().max(60).nullable().optional(), points: z.number().int().min(0).default(0),
});

export async function POST(request: NextRequest) {
  if (isDemo) return fail("시연 모드에서는 실제 결제를 진행할 수 없습니다.", 503);
  if (!process.env.TOSS_SECRET_KEY || !process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) return fail("결제 서비스가 설정되지 않았습니다.", 503);
  const context = await customerContext(request); if (!context) return fail("로그인이 필요합니다.", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return fail("주문 정보가 올바르지 않습니다.");
  await context.db.rpc("release_expired_checkouts");
  const { data, error } = await context.db.rpc("prepare_checkout", { p_user: context.user.id, p_lines: parsed.data.items, p_address: parsed.data.address, p_coupon: parsed.data.couponCode || null, p_points: parsed.data.points });
  if (error) return fail(error.message);
  if (data.amount === 0) {
    const { error: pointError } = await context.db.rpc("confirm_zero_checkout", { p_order_code: data.orderId });
    if (pointError) return fail(pointError.message);
    return NextResponse.json({ ...data, pointsOnly: true });
  }
  return NextResponse.json(data);
}
