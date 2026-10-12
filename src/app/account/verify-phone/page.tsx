"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/components/store-provider";
import { normalizeKrPhone } from "@/lib/phone";
import { getBrowserSupabase } from "@/lib/supabase";

export default function VerifyPhonePage() {
  const {user,getToken}=useStore();const [phone,setPhone]=useState(String(user?.user_metadata?.phone||""));const [otp,setOtp]=useState("");const [sent,setSent]=useState(false);const [message,setMessage]=useState("");
  async function send(event:React.FormEvent){event.preventDefault();try{const number=normalizeKrPhone(phone);const {error}=await getBrowserSupabase()!.auth.updateUser({phone:number});if(error)throw error;setSent(true);setMessage("인증번호를 보냈습니다.");}catch(error){setMessage(error instanceof Error?error.message:"문자를 보내지 못했습니다.");}}
  async function verify(event:React.FormEvent){event.preventDefault();try{const number=normalizeKrPhone(phone);const {error}=await getBrowserSupabase()!.auth.verifyOtp({phone:number,token:otp,type:"phone_change"});if(error)throw error;const token=await getToken();const response=await fetch("/api/account/verify-phone",{method:"POST",headers:{Authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok)throw Error(data.error);setMessage("휴대전화 인증이 완료되었습니다.");}catch(error){setMessage(error instanceof Error?error.message:"인증에 실패했습니다.");}}
  return <main className="auth-card"><p className="eyebrow">ACCOUNT SECURITY</p><h1>휴대전화 인증</h1><p>가입 이메일 찾기에 사용할 휴대전화를 인증해 주세요. SMS 서비스 설정 후 이용할 수 있습니다.</p>{!user?<Link href="/auth" className="button button-dark">로그인하기</Link>:<><form onSubmit={send}><div className="form-field"><label htmlFor="phone">휴대전화</label><input id="phone" type="tel" required value={phone} onChange={(event)=>setPhone(event.target.value)}/></div><button className="button button-dark">인증번호 보내기</button></form>{sent&&<form onSubmit={verify}><div className="form-field"><label htmlFor="otp">인증번호</label><input id="otp" required value={otp} onChange={(event)=>setOtp(event.target.value)}/></div><button className="button button-dark">인증 완료</button></form>}{message&&<p role="status">{message}</p>}</>}</main>;
}
