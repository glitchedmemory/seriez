export const dynamic = "force-dynamic";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import TabBar, { Sidebar } from "@/components/TabBar";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/lib/theme";
import { BotProvider } from "@/components/BotProvider";
import { isBot } from "@/lib/bot";
import AdminAwareLayout from "@/components/AdminAwareLayout";
import FeedbackWidget from "@/components/FeedbackWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const locales = ["en", "ko", "ja", "zh", "fr", "de", "es"] as const;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://seriez.app";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("meta");

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      template: "%s — Seriez",
      default: t("title"),
    },
    description: t("description"),
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/icons/icon-32.png", type: "image/png", sizes: "32x32" },
        { url: "/icons/icon-16.png", type: "image/png", sizes: "16x16" },
      ],
      apple: [
        { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      ],
      other: [
        { url: "/icons/icon-192.png", sizes: "192x192" },
        { url: "/icons/icon-512.png", sizes: "512x512" },
      ],
    },
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      title: "Seriez",
      statusBarStyle: "black-translucent",
    },
    alternates: {
      canonical: `${SITE_URL}`,
      languages: Object.fromEntries(
        locales.map((l) => [
          l,
          l === "en" ? `${SITE_URL}` : `${SITE_URL}/${l}`,
        ])
      ),
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
      siteName: "Seriez",
      locale: locale === "en" ? "en_US" : locale,
      images: [
        {
          url: "/og-image.svg",
          width: 1200,
          height: 630,
          alt: t("title"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/og-image.svg"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0f0f1a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const bot = await isBot();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'light' || theme === 'dark') {
                    document.documentElement.classList.toggle('light', theme === 'light');
                  } else if (theme === 'system') {
                    document.documentElement.classList.toggle(
                      'light',
                      window.matchMedia('(prefers-color-scheme: light)').matches
                    );
                  }
                  // else: no theme stored → default to dark (no 'light' class)
                } catch (e) {}
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Seriez",
              url: "https://seriez.app",
              logo: "https://seriez.app/icons/icon-192.png",
              description: "Seriez is a tracking platform for movies, TV shows, and anime. Rate, review, and discover your next watch. Community-powered ratings and personalized recommendations.",
              sameAs: ["https://seriez.app"],
              knowsAbout: ["Movies", "TV Shows", "Anime", "Streaming", "Filmography", "Watch Tracking"],
            }),
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var e=Date.now(),n=0,t=document.title||"",o=document.referrer||"",s=!1;function r(){if(s)return;s=!0;var i=Math.round((Date.now()-e)/1e3);navigator.sendBeacon("/api/analytics",JSON.stringify({page:t,referer:o,duration:i,scroll_depth:n}))}window.addEventListener("beforeunload",r);window.addEventListener("pagehide",r);document.addEventListener("visibilitychange",function(){"hidden"===document.visibility&&r()});window.addEventListener("scroll",function(){var e=document.documentElement.scrollTop,t=document.documentElement.scrollHeight-window.innerHeight;if(t>0){var o=Math.round(e/t*100);o>n&&(n=o)}},{passive:!0})})();` }} />
      </head>
      <body className="min-h-full flex bg-bg-primary text-text-primary">
        <BotProvider isBot={bot}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <AdminAwareLayout>
              {children}
            </AdminAwareLayout>
            <FeedbackWidget />
          </ThemeProvider>
        </NextIntlClientProvider>
        </BotProvider>
      </body>
    </html>
  );
}
