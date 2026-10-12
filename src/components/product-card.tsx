import Image from "next/image";
import Link from "next/link";
import { Product, formatWon } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  return <Link href={`/product/${product.slug}`} className="product-card"><div className="product-media"><Image src={product.image_urls[0]} alt={product.name} fill sizes="(max-width: 650px) 50vw, (max-width: 1050px) 33vw, 25vw"/>{product.badge && <span className="product-badge">{product.badge}</span>}<span className="quick-view">자세히 보기 <span>↗</span></span></div><div className="product-info"><p>{product.name}</p><span>{formatWon(product.price)}</span></div></Link>;
}
