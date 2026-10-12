import Link from "next/link";

export function Footer() {
  return <footer className="footer"><div className="container footer-grid"><div><Link href="/" className="wordmark footer-logo">FULGERE<span>®</span></Link><p>당신의 매일을 특별하게 만드는 실루엣.<br/>FULGERE에서 나만의 스타일을 발견하세요.</p></div><div><h3>SHOP</h3><Link href="/shop">전체 상품</Link><Link href="/shop?category=dresses">드레스</Link><Link href="/shop?category=tailoring">테일러링</Link><Link href="/shop?sort=new">신상품</Link></div><div><h3>HELP</h3><Link href="/help">고객센터</Link><Link href="/help?tab=faq">자주 묻는 질문</Link><Link href="/account?tab=tickets">1:1 문의</Link><Link href="/help?tab=shipping">배송·반품 안내</Link></div><div><h3>FULGERE</h3><p>새로운 컬렉션과 이야기를<br/>쇼핑몰에서 만나보세요.</p><Link href="/shop" className="text-link">컬렉션 보기 →</Link></div></div><div className="container footer-bottom"><span>© FULGERE. ALL RIGHTS RESERVED.</span><span>운영 정보와 약관은 정식 출시 전 게시됩니다.</span></div></footer>;
}
