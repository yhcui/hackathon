/**
 * Root Layout —— Next.js App Router 的根布局
 *
 * 在 Next.js App Router 中，layout.tsx 是所有页面的共同外壳。
 * 它定义了 <html>、<body> 标签，以及包裹所有页面的共享组件。
 *
 * 这里的 Providers 来自 wagmi.tsx，为整个应用注入 Web3 能力。
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/config/wagmi";
import "./globals.css";

// 加载字体（Geist 是 Vercel 开源的现代无衬线字体）
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 页面的 <title> 和 <meta description>
export const metadata: Metadata = {
  title: "EarnFlow — One-Click Yield Deposit",
  description: "Simple DeFi yield deposition powered by LI.FI Earn API",
};

/**
 * RootLayout 组件
 *
 * 这是 Next.js 约定的根布局。children 就是每个页面的内容（page.tsx 的返回值）。
 * 所有页面都会被 Providers 包裹，因此都能使用 wagmi / RainbowKit hooks。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
