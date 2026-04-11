import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import TelegramProvider from "@/components/TelegramProvider";
import Header from "@/components/Header";
import AnimatedBackground from "@/components/AnimatedBackground";
import GradientOrbs from "@/components/GradientOrbs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FoodBalance - Здорове харчування з доставкою",
  description: "Замовте здорове харчування з доставкою додому",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative">
        <GradientOrbs />
        <AnimatedBackground />
        <Header />
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
