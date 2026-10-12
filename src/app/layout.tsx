import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StoreProvider } from "@/components/store-provider";
import { EventPopup } from "@/components/event-popup";
import "./globals.css";

export const metadata: Metadata = { title: { default: "FULGERE | 개성을 입다", template: "%s | FULGERE" }, description: "일상에 특별함을 더하는 프리미엄 여성복, FULGERE." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body><StoreProvider><Header/>{children}<Footer/><EventPopup/></StoreProvider></body></html>;
}
