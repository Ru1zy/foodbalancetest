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
  title: "Food Balance - Здорове харчування з доставкою",
  description: "Замовте здорове харчування з доставкою додому",
  icons: {
    icon: "/foodbalancelogo.png",
    apple: "/foodbalancelogo.png",
  },
  openGraph: {
    title: "Food Balance - Здорове харчування з доставкою",
    description: "Замовте здорове харчування з доставкою додому",
    images: ["/foodbalancelogo.png"],
  },
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
      <body className="relative flex min-h-full flex-col overflow-x-hidden bg-slate-50">
        <GradientOrbs />
        <AnimatedBackground />
        <Header />
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
