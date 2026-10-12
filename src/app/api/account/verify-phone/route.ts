import { NextRequest, NextResponse } from "next/server";
import { customerContext, fail } from "@/lib/server";

export async function POST(request:NextRequest){const context=await customerContext(request);if(!context)return fail("로그인이 필요합니다.",401);const {data,error}=await context.db.auth.admin.getUserById(context.user.id);if(error||!data.user.phone)return fail("인증된 휴대전화가 없습니다.");const {error:updateError}=await context.db.from("profiles").update({phone:data.user.phone,phone_verified:true}).eq("id",context.user.id);if(updateError)return fail(updateError.message,500);return NextResponse.json({ok:true});}
