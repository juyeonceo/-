import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, tokenFrom, tossAuth } from "@/lib/server";
import { requireAdmin } from "@/lib/supabase";

export async function POST(request:NextRequest){
  const context=await requireAdmin(tokenFrom(request));if(!context||context.role!=="owner")return fail("환불 권한이 필요합니다.",403);
  const parsed=z.object({requestId:z.uuid()}).safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail("요청 ID가 올바르지 않습니다.");
  const {data:quote,error:claimError}=await context.db.rpc("claim_refund",{p_request_id:parsed.data.requestId});if(claimError)return fail(claimError.message);
  let tossResult:Record<string,unknown>|null=null;
  if(quote.cashAmount>0){
    const authorization=tossAuth();if(!authorization){await context.db.rpc("reset_refund",{p_request_id:parsed.data.requestId,p_note:"PG 키가 없습니다."});return fail("결제 서비스가 설정되지 않았습니다.",503);}
    const response=await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(quote.paymentKey)}/cancel`,{method:"POST",headers:{Authorization:authorization,"Content-Type":"application/json","Idempotency-Key":parsed.data.requestId},body:JSON.stringify({cancelReason:quote.reason,cancelAmount:quote.cashAmount}),cache:"no-store"});
    tossResult=await response.json();
    if(!response.ok){await context.db.rpc("reset_refund",{p_request_id:parsed.data.requestId,p_note:String(tossResult?.message||"PG 취소 실패")});return fail(String(tossResult?.message||"결제 취소에 실패했습니다."),502);}
  }
  const {data,error}=await context.db.rpc("complete_refund",{p_request_id:parsed.data.requestId,p_toss_response:tossResult});
  if(error){console.error("PG cancellation succeeded but local refund finalization failed",parsed.data.requestId,error.message);return fail("PG 취소 후 주문 기록을 완료하지 못했습니다. 이 요청을 다시 처리하지 말고 결제 내역을 대조해 주세요.",500);}
  await context.db.from("admin_audit").insert({actor_id:context.user.id,action:"request.refund",target_table:"service_requests",target_id:parsed.data.requestId,details:{kind:data,cashAmount:quote.cashAmount,pointsAmount:quote.pointsAmount}});
  return NextResponse.json({status:data,refundAmount:quote.cashAmount});
}
