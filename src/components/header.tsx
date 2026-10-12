"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { categories } from "@/lib/types";
import { useStore } from "./store-provider";

export function Header() {
  const { cart, user } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  function submitSearch(event: React.FormEvent) { event.preventDefault(); router.push(`/shop?q=${encodeURIComponent(query.trim())}`); setSearchOpen(false); }
  return <>
    <div className="announcement">나만의 스타일을 빛나게, FULGERE <span>·</span> 10만원 이상 무료배송</div>
    <header className="site-header">
      <div className="header-main container">
        <button className="icon-button mobile-only" aria-label="메뉴 열기" onClick={() => setMenuOpen(true)}><Menu size={22}/></button>
        <Link href="/" className="wordmark" aria-label="FULGERE 홈">FULGERE<span>®</span></Link>
        <div className="header-actions">
          <button className="icon-button" aria-label="검색" onClick={() => setSearchOpen((open) => !open)}><Search size={21}/></button>
          <Link className="icon-button" aria-label="마이페이지" href={user ? "/account" : "/auth"}><UserRound size={21}/></Link>
          <Link className="icon-button bag-button" aria-label={`장바구니 ${count}개`} href="/cart"><ShoppingBag size={21}/>{count > 0 && <span className="bag-count">{count}</span>}</Link>
        </div>
      </div>
      <nav className="desktop-nav container" aria-label="상품 카테고리">
        {categories.map((category) => <Link key={category.id} href={`/shop${category.id === "all" ? "" : `?category=${category.id}`}`}>{category.label}</Link>)}
        <Link className="nav-accent" href="/shop?sort=new">NEW IN</Link>
      </nav>
      {searchOpen && <form className="search-bar" onSubmit={submitSearch}><div className="container search-inner"><Search size={20}/><input autoFocus aria-label="상품 검색어" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="찾으시는 스타일을 검색해보세요"/><button type="submit">검색</button><button type="button" aria-label="검색 닫기" onClick={() => setSearchOpen(false)}><X size={20}/></button></div></form>}
    </header>
    {menuOpen && <div className="drawer-overlay" onClick={() => setMenuOpen(false)}><aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-top"><span className="wordmark small">FULGERE</span><button className="icon-button" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)}><X/></button></div><p className="eyebrow">EXPLORE COLLECTION</p>{categories.map((category) => <Link onClick={() => setMenuOpen(false)} key={category.id} href={`/shop${category.id === "all" ? "" : `?category=${category.id}`}`}>{category.label}</Link>)}<div className="drawer-divider"/><Link onClick={() => setMenuOpen(false)} href="/help">고객센터</Link><Link onClick={() => setMenuOpen(false)} href={user ? "/account" : "/auth"}>마이페이지</Link></aside></div>}
  </>;
}
