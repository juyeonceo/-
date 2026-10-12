import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getProducts } from "@/lib/catalog";

export default async function Home() {
  const products = await getProducts();
  return <main>
    <section className="hero"><Image src="/images/hero.png" alt="FULGERE 가을 컬렉션을 입은 두 모델" fill priority sizes="100vw"/><div className="hero-shade"/><div className="container hero-content"><p className="eyebrow light">THE NEW SEASON · 2026</p><h1>매일을<br/><em>특별하게.</em></h1><p>당신다운 실루엣으로 완성하는 새로운 순간.</p><Link href="/shop" className="button button-light">컬렉션 만나보기 <ArrowUpRight size={18}/></Link></div><div className="hero-index">01 / 03 <span>—</span> NEW COLLECTION</div></section>
    <section className="intro-strip"><span>STYLE WITH CHARACTER</span><span className="intro-line"/><span>DESIGNED TO BE REMEMBERED</span></section>
    <section className="container section-space"><div className="section-heading"><div><p className="eyebrow">CURATED FOR YOU</p><h2>지금 가장 빛나는 스타일</h2></div><Link href="/shop" className="text-link">모든 상품 보기 <ArrowRight size={17}/></Link></div><div className="product-grid">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product}/>)}</div></section>
    <section className="editorial"><div className="editorial-image"><Image src="/images/ivory-suit.png" alt="FULGERE 아이보리 테일러링" fill sizes="(max-width: 800px) 100vw, 50vw"/></div><div className="editorial-copy"><p className="eyebrow">THE ART OF GETTING DRESSED</p><h2>우아함은<br/>나의 방식대로.</h2><p>시간이 지나도 마음에 남는 옷. 섬세한 디테일과 자신감 있는 실루엣이 당신의 이야기를 완성합니다.</p><Link href="/shop?category=tailoring" className="button button-dark">테일러링 살펴보기 <ArrowUpRight size={18}/></Link><span className="editorial-number">FULGERE / 001</span></div></section>
    <section className="container section-space category-section"><div className="section-heading"><div><p className="eyebrow">EXPLORE THE EDIT</p><h2>당신의 취향을 찾아서</h2></div></div><div className="category-grid"><Link href="/shop?category=dresses" className="category-tile"><Image src="/images/oxblood-dress.png" alt="드레스 컬렉션" fill sizes="(max-width: 700px) 100vw, 50vw"/><span>01 / DRESSES</span><strong>드레스 <ArrowUpRight/></strong></Link><Link href="/shop?category=knitwear" className="category-tile"><Image src="/images/charcoal-knit.png" alt="니트웨어 컬렉션" fill sizes="(max-width: 700px) 100vw, 50vw"/><span>02 / KNITWEAR</span><strong>니트웨어 <ArrowUpRight/></strong></Link></div></section>
    <section className="brand-note"><div className="container"><p className="eyebrow">MADE FOR YOUR MOMENTS</p><h2>옷이 당신을 기억하게.<br/><em>당신도 그 순간을 기억하게.</em></h2><p>FULGERE는 입는 사람의 개성을 빛내는 옷을 만듭니다.</p></div></section>
  </main>;
}
