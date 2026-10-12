"use client";

import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/components/store-provider";
import { formatWon } from "@/lib/types";

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart } = useStore();
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const shipping = subtotal >= 100000 || !subtotal ? 0 : 3000;
  return <main className="narrow-page"><h1>장바구니 <span className="muted">({cart.length})</span></h1>{cart.length === 0 ? <div className="empty-state"><h2>장바구니가 비어 있습니다.</h2><p>마음에 드는 스타일을 담아보세요.</p><Link className="button button-dark" href="/shop">쇼핑 계속하기</Link></div> : <div className="cart-layout"><div>{cart.map((line) => <div className="cart-line" key={line.variant.id}><Image src={line.product.image_urls[0]} alt={line.product.name} width={110} height={138}/><div><h3>{line.product.name}</h3><p>{line.variant.color} / {line.variant.size}</p><div className="quantity-control"><button aria-label="수량 줄이기" onClick={() => updateQuantity(line.variant.id, line.quantity - 1)}>−</button><span>{line.quantity}</span><button aria-label="수량 늘리기" onClick={() => updateQuantity(line.variant.id, line.quantity + 1)}>+</button></div><br/><button className="remove-link" onClick={() => removeFromCart(line.variant.id)}>삭제</button></div><strong>{formatWon(line.product.price * line.quantity)}</strong></div>)}</div><aside className="summary-card"><h2>주문 요약</h2><div className="summary-row"><span>상품 금액</span><span>{formatWon(subtotal)}</span></div><div className="summary-row"><span>배송비</span><span>{shipping ? formatWon(shipping) : "무료"}</span></div><div className="summary-row total"><span>결제 예정 금액</span><span>{formatWon(subtotal + shipping)}</span></div><Link className="button button-dark" href="/checkout">주문하기 →</Link><p className="form-help">결제는 회원 로그인 후 진행됩니다.</p></aside></div>}</main>;
}
