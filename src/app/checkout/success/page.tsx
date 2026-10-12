"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useStore } from "@/components/store-provider";

function SuccessContent() {
  const params = useSearchParams();
  const { getToken, clearCart } = useStore();
  const [state, setState] = useState<"checking" | "success" | "error">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = params.get("amount");
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!paymentKey || !orderId || !amount) {
        setState("error");
        setMessage("결제 정보가 없습니다.");
        return;
      }
      try {
        const token = await getToken();
        const response = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "결제 확인에 실패했습니다.");
        if (active) { clearCart(); setState("success"); }
      } catch (error) {
        if (active) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "결제 확인에 실패했습니다.");
        }
      }
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [params, getToken, clearCart]);

  return <main className="narrow-page"><div className="empty-state"><h1>{state === "checking" ? "결제를 확인하고 있습니다" : state === "success" ? "주문이 완료되었습니다" : "결제 확인이 필요합니다"}</h1><p>{state === "success" ? "FULGERE와 함께할 새로운 순간을 기대해 주세요." : state === "error" ? message : "잠시만 기다려 주세요."}</p><Link className="button button-dark" href={state === "success" ? "/account" : "/help"}>{state === "success" ? "주문 내역 보기" : "고객센터 문의"}</Link></div></main>;
}

export default function SuccessPage() {
  return <Suspense fallback={<main className="narrow-page">결제를 확인하고 있습니다.</main>}><SuccessContent /></Suspense>;
}
