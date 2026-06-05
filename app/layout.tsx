import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TabBar, { Sidebar } from "@/components/TabBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reelist — Track & Discover",
  description: "Track movies, TV shows, and anime. Get smart recommendations.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Reelist",
    statusBarStyle: "black-translucent",
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
        <main className="flex-1 min-w-0 md:pb-0 pb-16">{children}</main>
        <TabBar />
      </body>
    </html>
  );
}
