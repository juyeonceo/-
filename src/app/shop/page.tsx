import { getProducts } from "@/lib/catalog";
import { ShopClient } from "./shop-client";

export default async function Shop({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; sort?: string }> }) {
  const params = await searchParams;
  return <ShopClient products={await getProducts()} initialCategory={params.category || "all"} initialQuery={params.q || ""} initialSort={params.sort || "recommended"}/>;
}
