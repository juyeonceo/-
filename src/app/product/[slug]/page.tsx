import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/catalog";
import { formatWon } from "@/lib/types";
import { ProductPurchase } from "./product-purchase";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  return <main className="container detail-grid"><div className="detail-image"><Image src={product.image_urls[0]} alt={product.name} fill priority sizes="(max-width: 760px) 100vw, 55vw"/></div><div className="detail-info"><p className="eyebrow"><Link href="/shop">COLLECTION</Link> / {product.category_id.toUpperCase()}</p><h1>{product.name}</h1><div className="detail-price">{formatWon(product.price)}</div>{product.is_preorder && <div className="preorder-note">예약 구매 상품입니다. 예상 입고일: {product.preorder_date || "추후 안내"}<br/>예약 시 결제가 완료되며 입고 후 순차 발송됩니다.</div>}<p className="detail-description">{product.description}</p><ProductPurchase product={product}/><div className="detail-accordions"><details open><summary>상품 정보</summary><p>FULGERE의 오리지널 컬렉션입니다. 사이즈별 상세 실측은 상품 등록 시 함께 안내됩니다.</p></details><details><summary>배송 및 반품 안내</summary><p>배송 일정과 반품 가능 기간은 고객센터의 운영 정책을 확인해 주세요. 예약 상품은 표시된 입고 예정일을 기준으로 순차 발송됩니다.</p></details><details><summary>상품 리뷰</summary><p>배송 완료 후 마이페이지에서 리뷰를 작성할 수 있습니다.</p></details></div></div></main>;
}
