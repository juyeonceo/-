import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase, getUserFromToken } from "./supabase";

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const tokenFrom = (request: NextRequest) => request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;

export async function customerContext(request: NextRequest) {
  const user = await getUserFromToken(tokenFrom(request));
  const db = getAdminSupabase();
  return user && db ? { user, db } : null;
}

export function tossAuth() {
  const key = process.env.TOSS_SECRET_KEY;
  return key ? `Basic ${Buffer.from(`${key}:`).toString("base64")}` : null;
}
