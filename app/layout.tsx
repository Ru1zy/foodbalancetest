import type { Metadata } from "next";
import { Comfortaa } from "next/font/google";
import TelegramProvider from "@/components/TelegramProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedBackground from "@/components/AnimatedBackground";
import GradientOrbs from "@/components/GradientOrbs";
import ConditionalWrapper from "@/components/ConditionalWrapper";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const comfortaa = Comfortaa({
  subsets: ["latin", "cyrillic"],
  variable: "--font-comfortaa",
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
      className={`${comfortaa.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <GradientOrbs />
          <AnimatedBackground />
          
          <ConditionalWrapper>
            <Header />
          </ConditionalWrapper>

          <main className="flex-grow flex flex-col">
            <TelegramProvider>{children}</TelegramProvider>
          </main>

          <ConditionalWrapper>
            <Footer />
          </ConditionalWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
