"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadTossPayments, TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { useStore } from "@/components/store-provider";
import { formatWon } from "@/lib/types";

type Prepared = { orderId: string; amount: number; customerKey: string; orderName: string; subtotal: number; shippingFee: number; couponDiscount: number; pointsUsed: number; pointsOnly?: boolean };

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, user, authLoading, getToken, clearCart } = useStore();
  const [recipient, setRecipient] = useState(""); const [phone, setPhone] = useState(""); const [postalCode, setPostalCode] = useState(""); const [address, setAddress] = useState(""); const [detail, setDetail] = useState("");
  const [coupon, setCoupon] = useState(""); const [points, setPoints] = useState(0); const [prepared, setPrepared] = useState<Prepared | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [widgetReady, setWidgetReady] = useState(false);
  const widgets = useRef<TossPaymentsWidgets | null>(null);
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const estimatedShipping = subtotal >= 100000 ? 0 : 3000;
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const hasPaymentKey = Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY);

  useEffect(() => {
    if (!prepared || !hasPaymentKey) return;
    let disposed = false;
    (async () => { try { const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!); const next = toss.widgets({ customerKey: prepared.customerKey }); await next.setAmount({ currency: "KRW", value: prepared.amount }); await next.renderPaymentMethods({ selector: "#payment-method" }); await next.renderAgreement({ selector: "#agreement" }); if (!disposed) { widgets.current = next; setWidgetReady(true); } } catch (error) { if (!disposed) setMessage(error instanceof Error ? error.message : "결제창을 불러오지 못했습니다."); } })();
    return () => { disposed = true; };
  }, [prepared, hasPaymentKey]);

  async function prepare(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    if (!user) { setMessage("결제를 진행하려면 로그인해 주세요."); return; }
    if (!cart.length) { setMessage("장바구니가 비어 있습니다."); return; }
    setBusy(true);
    try {
      const token = await getToken();
      const response = await fetch("/api/checkout/prepare", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ items: cart.map((line) => ({ variantId: line.variant.id, quantity: line.quantity })), address: { recipient, phone, postalCode, address, detail }, couponCode: coupon.trim() || null, points: Number(points) || 0 }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "주문을 준비하지 못했습니다.");
      if (result.pointsOnly) { clearCart(); router.push("/account?tab=orders"); return; }
      setPrepared(result); setWidgetReady(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "주문을 준비하지 못했습니다."); } finally { setBusy(false); }
  }

  async function pay() { if (!prepared || !widgets.current) return; try { await widgets.current.requestPayment({ orderId: prepared.orderId, orderName: prepared.orderName, customerEmail: user?.email, customerName: recipient, successUrl: `${location.origin}/checkout/success`, failUrl: `${location.origin}/checkout/fail` }); } catch (error) { setMessage(error instanceof Error ? error.message : "결제 요청에 실패했습니다."); } }

  return <main className="narrow-page"><h1>주문 / 결제</h1>{authLoading ? <p>회원 정보를 확인하는 중입니다.</p> : !user ? <div className="notice-box">구매는 회원만 가능합니다. <Link href="/auth" className="text-link">로그인하기</Link></div> : !cart.length ? <div className="empty-state"><p>장바구니에 상품을 담아 주세요.</p><Link href="/shop" className="button button-dark">상품 보러가기</Link></div> : <div className="checkout-layout"><form onSubmit={prepare}><section className="form-section"><h2>배송 정보</h2><div className="form-field"><label htmlFor="recipient">받는 분</label><input id="recipient" required value={recipient} onChange={(event) => setRecipient(event.target.value)} disabled={!!prepared}/></div><div className="form-field"><label htmlFor="phone">휴대전화</label><input id="phone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} disabled={!!prepared}/></div><div className="form-field"><label htmlFor="postal">우편번호</label><input id="postal" required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} disabled={!!prepared}/></div><div className="form-field"><label htmlFor="address">주소</label><input id="address" required value={address} onChange={(event) => setAddress(event.target.value)} disabled={!!prepared}/></div><div className="form-field"><label htmlFor="detail">상세주소</label><input id="detail" value={detail} onChange={(event) => setDetail(event.target.value)} disabled={!!prepared}/></div></section><section className="form-section"><h2>할인 혜택</h2><div className="form-field"><label htmlFor="coupon">쿠폰 코드</label><input id="coupon" value={coupon} onChange={(event) => setCoupon(event.target.value)} disabled={!!prepared} placeholder="보유한 쿠폰 코드 입력"/></div><div className="form-field"><label htmlFor="points">사용 포인트</label><input id="points" type="number" min="0" value={points} onChange={(event) => setPoints(Number(event.target.value))} disabled={!!prepared}/></div><p className="form-help">할인·포인트와 최종 금액은 주문 준비 시 서버에서 검증합니다.</p></section>{message && <p role="alert" className="error-text">{message}</p>}{!prepared && <button className="button button-dark" disabled={busy || isDemo || !hasPaymentKey}>{busy ? "확인 중..." : "결제 정보 확인"}</button>}{(isDemo || !hasPaymentKey) && <div className="notice-box" style={{marginTop:16}}>현재는 시연용 화면입니다. 실제 결제에는 데이터베이스 스키마와 토스페이먼츠 키가 필요합니다.</div>}{prepared && <section className="form-section"><h2>결제 수단</h2><div id="payment-method"/><div id="agreement"/><button type="button" className="button button-dark" disabled={!widgetReady} onClick={pay}>{widgetReady ? `${formatWon(prepared.amount)} 결제하기` : "결제창 준비 중..."}</button></section>}</form><aside className="summary-card"><h2>주문 상품</h2>{cart.map((line) => <div className="summary-row" key={line.variant.id}><span>{line.product.name} · {line.variant.size} × {line.quantity}</span><span>{formatWon(line.product.price * line.quantity)}</span></div>)}<div className="summary-row"><span>상품 금액</span><span>{formatWon(prepared?.subtotal ?? subtotal)}</span></div><div className="summary-row"><span>배송비</span><span>{formatWon(prepared?.shippingFee ?? estimatedShipping)}</span></div>{prepared && <><div className="summary-row"><span>쿠폰 할인</span><span>−{formatWon(prepared.couponDiscount)}</span></div><div className="summary-row"><span>포인트 사용</span><span>−{formatWon(prepared.pointsUsed)}</span></div></>}<div className="summary-row total"><span>결제 금액</span><span>{formatWon(prepared?.amount ?? subtotal + estimatedShipping)}</span></div></aside></div>}</main>;
}
