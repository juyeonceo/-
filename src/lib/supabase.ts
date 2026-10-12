import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase() {
  if (!url || !publishable) return null;
  if (!browserClient) browserClient = createClient(url, publishable, { auth: { persistSession: true, autoRefreshToken: true } });
  return browserClient;
}

export function getPublicSupabase() {
  if (!url || !publishable) return null;
  return createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getUserFromToken(token: string | null) {
  if (!token) return null;
  const client = getPublicSupabase();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

export async function requireAdmin(token: string | null) {
  const user = await getUserFromToken(token);
  const db = getAdminSupabase();
  if (!user || !db) return null;
  const { data } = await db.from("profiles").select("role,status").eq("id", user.id).single();
  return data?.status === "active" && ["owner", "merchandiser", "fulfillment", "support"].includes(data.role) ? { user, role: data.role as string, db } : null;
}

export const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
