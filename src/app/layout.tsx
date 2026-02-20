import type { Metadata } from "next";
import "./globals.css";

export const metadata = {
  title: "zzQR",
  description: "링크/텍스트를 지금 QR로 바꾸는 초간편 생성기",
  manifest: "/manifest.webmanifest",

  icons: {
    apple: "/apple-touch-icon.png"
  },

  appleWebApp: {
    capable: true,
    title: "zzQR",
    statusBarStyle: "default"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}