export const dynamic = "force-dynamic";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TabBar, { Sidebar } from "@/components/TabBar";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";

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
      <body className="min-h-full flex bg-[#0f0f1a] text-white">
        <Sidebar />
        <main className="flex-1 min-w-0 md:pb-0 pb-16">
            <ErrorBoundary sectionName="App">
              {children}
            </ErrorBoundary>
          </main>
        <TabBar />
        <ScrollToTop />
      </body>
    </html>
  );
}
