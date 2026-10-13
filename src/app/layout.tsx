import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "FB Content Studio — Tạo Bài Theo Sheet Prompt & Đăng Facebook Page",
  description:
    "Công cụ chọn chủ đề (Xã/Địa phương) từ Google Sheet, sinh Hook, chạy chuỗi Prompt 1-4 với 30 Key Gemini luân phiên và đăng tự động lên Facebook Page.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-[#f4f6f9] text-slate-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
