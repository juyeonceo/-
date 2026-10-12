"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";
import { normalizeKrPhone } from "@/lib/phone";

type Mode = "login" | "signup" | "reset" | "find";
export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [findSent, setFindSent] = useState(false);
  const [otp, setOtp] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); setBusy(true);
    try {
      const db = getBrowserSupabase(); if (!db) throw new Error("회원 서비스가 설정되지 않았습니다.");
      if (mode === "login") { const { error } = await db.auth.signInWithPassword({ email, password }); if (error) throw error; router.push("/account"); router.refresh(); }
      if (mode === "signup") { const { error } = await db.auth.signUp({ email, password, options: { data: { full_name: name, phone } } }); if (error) throw error; setMessage("가입 확인 메일을 보냈습니다. 이메일을 확인해 주세요."); }
      if (mode === "reset") { const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/update-password` }); if (error) throw error; setMessage("비밀번호 재설정 안내를 이메일로 보냈습니다."); }
      if (mode === "find") {
        const number = normalizeKrPhone(phone);
        if (!findSent) { const { error } = await db.auth.signInWithOtp({ phone: number, options: { shouldCreateUser: false } }); if (error) throw error; setFindSent(true); setMessage("인증번호를 보냈습니다."); }
        else { const { data, error } = await db.auth.verifyOtp({ phone: number, token: otp, type: "sms" }); if (error) throw error; setMessage(`가입 이메일: ${data.user?.email || "확인할 수 없음"}`); }
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "요청을 처리하지 못했습니다."); } finally { setBusy(false); }
  }
  return <main className="auth-card"><p className="eyebrow">WELCOME TO FULGERE</p><h1>{mode === "login" ? "다시 만나 반가워요" : mode === "signup" ? "FULGERE 회원가입" : mode === "reset" ? "비밀번호 찾기" : "아이디 찾기"}</h1><p>당신만의 스타일을 발견하는 여정을 시작하세요.</p><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>로그인</button><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>회원가입</button></div><form onSubmit={submit}>{mode === "signup" && <><div className="form-field"><label htmlFor="name">이름</label><input id="name" required value={name} onChange={(event) => setName(event.target.value)}/></div><div className="form-field"><label htmlFor="phone">휴대전화</label><input id="phone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="010-0000-0000"/></div></>}{mode !== "find" && <div className="form-field"><label htmlFor="email">이메일</label><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com"/></div>}{mode === "find" && <><div className="form-field"><label htmlFor="find-phone">가입한 휴대전화</label><input id="find-phone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)}/></div>{findSent&&<div className="form-field"><label htmlFor="find-otp">인증번호</label><input id="find-otp" required value={otp} onChange={(event)=>setOtp(event.target.value)}/></div>}</>}{(mode === "login" || mode === "signup") && <div className="form-field"><label htmlFor="password">비밀번호</label><input id="password" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상"/></div>}{message && <p role="status" className={message.includes("못") || message.includes("Error") ? "error-text" : "success-text"}>{message}</p>}<button type="submit" className="button button-dark" disabled={busy}>{busy ? "처리 중..." : mode === "login" ? "로그인" : mode === "signup" ? "회원가입" : mode === "reset" ? "재설정 메일 보내기" : findSent ? "인증하고 이메일 확인" : "인증번호 받기"}</button></form><div className="auth-extra"><button onClick={() => { setMode("find"); setFindSent(false); setMessage(""); }}>아이디 찾기</button><button onClick={() => { setMode("reset"); setMessage(""); }}>비밀번호 찾기</button></div></main>;
}
