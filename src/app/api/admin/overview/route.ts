import { NextRequest, NextResponse } from "next/server";
import { fail, tokenFrom } from "@/lib/server";
import { requireAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const context = await requireAdmin(tokenFrom(request));
  if (!context) return fail("관리자 권한이 필요합니다.", 403);
  const { db } = context;
  const names = ["categories","products","product_variants","orders","profiles","tickets","service_requests","posts","reviews","coupons","promotions","suppliers","purchase_orders","purchase_order_items","materials","faq","store_settings"] as const;
  const queries = await Promise.all(names.map(async (name) => {
    const query = db.from(name).select("*").limit(100);
    const { data, error } = await query;
    return [name, error ? [] : data || []] as const;
  }));
  return NextResponse.json({ role: context.role, data: Object.fromEntries(queries) });
}
