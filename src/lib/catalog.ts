import { connection } from "next/server";
import { demoProducts } from "./demo";
import { getPublicSupabase, isDemo } from "./supabase";
import { Product } from "./types";

export async function getProducts(): Promise<Product[]> {
  await connection();
  const db = getPublicSupabase();
  if (!db) return isDemo ? demoProducts : [];
  const { data, error } = await db.from("products").select("id,slug,name,description,category_id,price,compare_at_price,image_urls,badge,is_preorder,preorder_date,one_plus_one,variants:product_variants(id,product_id,size,color,sku,stock)").eq("status", "active").order("created_at", { ascending: false });
  if (error) { console.error("Catalog load failed", error.message); return isDemo ? demoProducts : []; }
  if (isDemo && !data?.length) return demoProducts;
  const { data: campaigns } = await db.from("promotions").select("product_id").eq("kind", "one_plus_one");
  const campaignIds = new Set((campaigns || []).map((campaign) => campaign.product_id));
  return ((data || []) as Product[]).map((product) => ({ ...product, one_plus_one: product.one_plus_one || campaignIds.has(product.id), badge: campaignIds.has(product.id) ? "1+1" : product.badge }));
}

export async function getProduct(slug: string) {
  const products = await getProducts();
  return products.find((product) => product.slug === slug) || null;
}
