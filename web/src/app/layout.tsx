import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlexPump AI | 정적 Dashboard MVP",
  description: "정적 fixture 기반 시연 화면. KHNP collector 및 Ridge 예측 출력과 미연결.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
