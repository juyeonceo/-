"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { categories, Product } from "@/lib/types";

export function ShopClient({ products, initialCategory, initialQuery, initialSort }: { products: Product[]; initialCategory: string; initialQuery: string; initialSort: string }) {
  const [category, setCategory] = useState(initialCategory);
  const query = initialQuery;
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState(initialSort);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const colors = [...new Set(products.flatMap((product) => product.variants.map((variant) => variant.color)))];
  const visible = useMemo(() => {
    let result = products.filter((product) => (category === "all" || product.category_id === category) && (!query || product.name.toLowerCase().includes(query.toLowerCase())) && (!size || product.variants.some((variant) => variant.size === size && variant.stock > 0)) && (!color || product.variants.some((variant) => variant.color === color)) && (!maxPrice || product.price <= Number(maxPrice)) && (!inStock || product.variants.some((variant) => variant.stock > 0)));
    if (sort === "price-asc") result = [...result].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") result = [...result].sort((a, b) => b.price - a.price);
    if (sort === "new") result = [...result].reverse();
    return result;
  }, [products, category, query, size, color, maxPrice, inStock, sort]);
  const sidebar = <div className="filter-sidebar-inner"><div className="filter-group"><h3>카테고리</h3>{categories.map((item) => <label key={item.id}><input type="radio" name="category" checked={category === item.id} onChange={() => setCategory(item.id)}/>{item.label}</label>)}</div><div className="filter-group"><h3>사이즈</h3><select aria-label="사이즈" value={size} onChange={(event) => setSize(event.target.value)}><option value="">전체</option>{["S", "M", "L"].map((item) => <option key={item}>{item}</option>)}</select></div><div className="filter-group"><h3>컬러</h3><select aria-label="컬러" value={color} onChange={(event) => setColor(event.target.value)}><option value="">전체</option>{colors.map((item) => <option key={item}>{item}</option>)}</select></div><div className="filter-group"><h3>가격</h3><select aria-label="최대 가격" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}><option value="">전체</option><option value="150000">15만원 이하</option><option value="200000">20만원 이하</option><option value="300000">30만원 이하</option></select></div><div className="filter-group"><label><input type="checkbox" checked={inStock} onChange={(event) => setInStock(event.target.checked)}/>재고 있는 상품만</label></div></div>;
  return <main><div className="container page-intro"><div className="breadcrumbs"><Link href="/">HOME</Link> / SHOP</div><p className="eyebrow">THE FULGERE COLLECTION</p><h1>전체 상품</h1><p>당신의 개성을 완성할 FULGERE의 컬렉션을 만나보세요.</p></div><div className="container catalog-layout"><aside className="filter-sidebar">{sidebar}</aside><div><button className="button button-outline mobile-filter" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={16}/> 필터 {filtersOpen ? "닫기" : "열기"}</button>{filtersOpen && <div className="mobile-filter-panel">{sidebar}</div>}<div className="catalog-toolbar"><span>{visible.length}개 상품</span><select className="sort-select" aria-label="정렬" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">추천순</option><option value="new">신상품순</option><option value="price-asc">낮은 가격순</option><option value="price-desc">높은 가격순</option></select></div>{visible.length ? <div className="product-grid catalog-products">{visible.map((product) => <ProductCard key={product.id} product={product}/>)}</div> : <div className="empty-state"><h2>조건에 맞는 상품이 없습니다.</h2><p>필터를 바꾸어 다시 찾아보세요.</p></div>}</div></div></main>;
}
