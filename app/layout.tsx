import type { Metadata } from "next";
import { Comfortaa } from "next/font/google";
import TelegramProvider from "@/components/TelegramProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedBackground from "@/components/AnimatedBackground";
import GradientOrbs from "@/components/GradientOrbs";
import ConditionalWrapper from "@/components/ConditionalWrapper";
import SupportWidget from "@/components/SupportWidget";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const comfortaa = Comfortaa({
  subsets: ["latin", "cyrillic"],
  variable: "--font-comfortaa",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "https://foodbalance.com.ua"),
  title: "Food Balance — Доставка здорового харчування та раціонів",
  description: "Сервіс доставки збалансованого здорового харчування та готових раціонів на кожен день. Свіжі страви з підрахунком калорій для схуднення, підтримки та спорту. Замовляйте онлайн!",
  keywords: [
    "доставка здорового харчування",
    "правильне харчування",
    "раціони їжі",
    "доставка їжі",
    "меню для схуднення",
    "спортивне харчування",
    "Food Balance",
    "збалансоване харчування",
    "готові раціони на кожен день",
    "підрахунок калорій",
    "дієтичне харчування",
    "доставка їжі київ",
  ],
  alternates: {
    canonical: "https://foodbalance.com.ua",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    type: "website",
    locale: "uk_UA",
    url: "https://foodbalance.com.ua",
    siteName: "Food Balance",
    title: "Food Balance — Доставка здорового харчування та раціонів",
    description: "Сервіс доставки збалансованого здорового харчування та готових раціонів на кожен день. Свіжі страви з підрахунком калорій для схуднення, підтримки та спорту.",
    images: [
      {
        url: "/icon.png",
        width: 500,
        height: 500,
        alt: "Food Balance — Доставка здорового харчування",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Food Balance — Доставка здорового харчування та раціонів",
    description: "Сервіс доставки збалансованого здорового харчування та готових раціонів на кожен день. Свіжі страви з підрахунком калорій для схуднення, підтримки та спорту.",
    images: ["/icon.png"],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "FoodEstablishment",
  name: "Food Balance",
  image: "https://foodbalance.com.ua/icon.png",
  url: "https://foodbalance.com.ua",
  description:
    "Сервіс доставки збалансованого здорового харчування та готових раціонів на кожен день. Свіжі страви з підрахунком калорій для схуднення, підтримки та спорту.",
  servesCuisine: "Здорове харчування, Дієтичне харчування, Фітнес-раціони",
  priceRange: "₴₴",
  currenciesAccepted: "UAH",
  paymentAccepted: "Готівка, Оплата карткою онлайн, Monobank",
  address: {
    "@type": "PostalAddress",
    addressCountry: "UA",
  },
  hasMenu: "https://foodbalance.com.ua/#menu",
  potentialAction: {
    "@type": "OrderAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://foodbalance.com.ua/",
      inLanguage: "uk-UA",
      actionPlatform: [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform",
      ],
    },
    deliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet",
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="flex min-h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
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
            <SupportWidget />
          </ConditionalWrapper>
          <Toaster 
            position="bottom-center"
            toastOptions={{
              className: 'dark:bg-slate-800 dark:text-slate-100',
              duration: 4000,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
