"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/components/store-provider";
import { Product } from "@/lib/types";

export function ProductPurchase({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const router = useRouter();
  const colors = [...new Set(product.variants.map((variant) => variant.color))];
  const [color, setColor] = useState(colors[0] || "");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const variant = product.variants.find((item) => item.color === color && item.size === size);
  function add(goToCart: boolean) {
    if (!variant) { setMessage("사이즈를 선택해 주세요."); return; }
    if (variant.stock < quantity) { setMessage("선택하신 수량의 재고가 부족합니다."); return; }
    addToCart(product, variant, quantity);
    setMessage("장바구니에 담았습니다.");
    if (goToCart) router.push("/cart");
  }
  return <div><span className="field-label">컬러</span><div className="option-row">{colors.map((item) => <button className={`option ${color === item ? "active" : ""}`} key={item} onClick={() => { setColor(item); setSize(""); }}>{item}</button>)}</div><span className="field-label">사이즈</span><div className="option-row">{[...new Set(product.variants.filter((item) => item.color === color).map((item) => item.size))].map((item) => { const stock = product.variants.find((v) => v.color === color && v.size === item)?.stock || 0; return <button className={`option ${size === item ? "active" : ""}`} disabled={!stock} key={item} onClick={() => setSize(item)}>{item}</button>; })}</div><span className="field-label">수량</span><div className="quantity-control"><button aria-label="수량 줄이기" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><span>{quantity}</span><button aria-label="수량 늘리기" onClick={() => setQuantity(Math.min(variant?.stock || 10, quantity + 1))}>+</button></div>{message && <p className="form-help" role="status">{message}</p>}<div className="detail-add"><button className="button button-outline" onClick={() => add(false)}>장바구니 담기</button><button className="button button-dark" onClick={() => add(true)}>{product.is_preorder ? "예약 구매하기" : "바로 구매하기"}</button></div></div>;
}
