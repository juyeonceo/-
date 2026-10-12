"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent) { event.preventDefault(); const { error } = await getBrowserSupabase()!.auth.updateUser({ password }); if (error) setMessage(error.message); else { setMessage("비밀번호가 변경되었습니다."); setTimeout(() => router.push("/account"), 900); } }
  return <main className="auth-card"><h1>새 비밀번호 설정</h1><form onSubmit={submit}><div className="form-field"><label htmlFor="new-password">새 비밀번호</label><input id="new-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)}/></div><button className="button button-dark">변경하기</button>{message && <p role="status">{message}</p>}</form></main>;
}
