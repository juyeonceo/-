import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function GET(request:NextRequest){const secret=process.env.CRON_SECRET;if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"unauthorized"},{status:401});const db=getAdminSupabase();if(!db)return NextResponse.json({error:"database unavailable"},{status:503});const {data,error}=await db.rpc("release_expired_checkouts");if(error)return NextResponse.json({error:error.message},{status:500});const points=await db.rpc("expire_all_points");if(points.error)return NextResponse.json({error:points.error.message},{status:500});return NextResponse.json({released:data,expiredPoints:points.data});}
