import { getProducts } from "@/lib/catalog";
import { HelpClient } from "./help-client";
export default async function HelpPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) { const { tab }=await searchParams; return <HelpClient initialTab={tab||"faq"} products={await getProducts()}/>; }
