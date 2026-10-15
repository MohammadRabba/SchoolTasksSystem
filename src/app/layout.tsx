import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Toaster as ToasterRadix } from "@/components/ui/toaster";
import SessionProviderWrapper from "@/components/layout/SessionProviderWrapper";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "نظام إدارة المدرسة | مدرسة ذكور المستقبل الصالح الأساسية العليا",
  description: "نظام إدارة المعلمين ومتابعة الأعمال الكتابية وحصص الإشغالات وتقارير المغادرة",
  icons: {
    icon: "/school-icon.svg",
    shortcut: "/school-icon.svg",
    apple: "/school-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${cairo.variable} font-sans antialiased bg-background text-foreground`}
      >
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
        <Toaster richColors position="top-center" />
        <ToasterRadix />
      </body>
    </html>
  );
}
