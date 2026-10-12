import Link from "next/link";
export default async function FailPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) { const { message } = await searchParams; return <main className="narrow-page"><div className="empty-state"><h1>결제를 완료하지 못했습니다</h1><p>{message || "결제를 취소했거나 오류가 발생했습니다."}</p><Link className="button button-dark" href="/checkout">결제 다시 시도하기</Link></div></main>; }
