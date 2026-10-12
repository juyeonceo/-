"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase";

type Popup = { id: string; title: string; image_url: string | null; link_url: string | null };
export function EventPopup() {
  const [popup,setPopup]=useState<Popup|null>(null);
  useEffect(()=>{const db=getBrowserSupabase();if(!db)return;db.from("promotions").select("id,title,image_url,link_url").eq("kind","popup").limit(1).then(({data})=>{const item=data?.[0];if(item&&!sessionStorage.getItem(`fulgere_popup_${item.id}`))setPopup(item);});},[]);
  if(!popup)return null;
  function close(){sessionStorage.setItem(`fulgere_popup_${popup!.id}`,"1");setPopup(null);}
  return <div className="popup-overlay" role="dialog" aria-modal="true" aria-label={popup.title}><div className="popup-card"><button className="popup-close" aria-label="팝업 닫기" onClick={close}><X size={20}/></button>{popup.image_url&&<div className="popup-image"><Image src={popup.image_url} alt="" fill unoptimized sizes="(max-width: 500px) 90vw, 420px"/></div>}<div className="popup-copy"><p className="eyebrow">FULGERE EVENT</p><h2>{popup.title}</h2>{popup.link_url&&<Link href={popup.link_url} onClick={close} className="button button-dark">자세히 보기 →</Link>}</div><button className="popup-dismiss" onClick={close}>오늘은 그만 보기</button></div></div>;
}
