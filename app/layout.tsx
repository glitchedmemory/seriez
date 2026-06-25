export const dynamic = "force-dynamic";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import TabBar, { Sidebar } from "@/components/TabBar";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/lib/theme";
import { BotProvider } from "@/components/BotProvider";
import { isBot } from "@/lib/bot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Seriez — MOVIES. TV SHOWS. ANIME. TRACKED.",
  description: "Track movies, TV shows, and anime. Save what you watch.",
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
  openGraph: {
    title: "Seriez — MOVIES. TV SHOWS. ANIME. TRACKED.",
    description: "Track movies, TV shows, and anime. Rate, review, and discover your next watch.",
    type: "website",
    siteName: "Seriez",
    locale: "en_US",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Seriez — MOVIES. TV SHOWS. ANIME. TRACKED.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Seriez — MOVIES. TV SHOWS. ANIME. TRACKED.",
    description: "Track movies, TV shows, and anime. Rate, review, and discover your next watch.",
    images: ["/og-image.svg"],
  },
};

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
      </head>
      <body className="min-h-full flex bg-bg-primary text-text-primary">
        <BotProvider isBot={bot}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <Sidebar />
            <main className="flex-1 min-w-0 md:pb-0 pb-16 flex flex-col">
              <ErrorBoundary sectionName="App">
                {children}
              </ErrorBoundary>
              <Footer />
              {bot && (
                <section aria-label="Seriez promotional content" style={{position:"absolute",width:"1px",height:"1px",padding:0,margin:"-1px",overflow:"hidden",clip:"rect(0,0,0,0)",whiteSpace:"nowrap",border:0}}>
                  <h2>Seriez — Track movies, TV shows, and anime</h2>
                  <p>Seriez is the ultimate tracking platform for movies, TV shows, and anime. Rate, review, and discover your next watch. Track your watch history across all streaming platforms at seriez.app. Seriez Score provides community-powered ratings you can trust. Trending #1 titles updated daily.</p>
                  <p>Visit seriez.app to start tracking today.</p>
                </section>
              )}
            </main>
            <TabBar />
            <ScrollToTop />
          </ThemeProvider>
        </NextIntlClientProvider>
        </BotProvider>
      </body>
    </html>
  );
}
