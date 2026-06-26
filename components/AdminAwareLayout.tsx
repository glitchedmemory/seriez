"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/TabBar";
import TabBar from "@/components/TabBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import ErrorBoundary from "@/components/ErrorBoundary";
import { isBot } from "@/lib/bot";

export default function AdminAwareLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 md:pb-0 pb-16 flex flex-col">
        <ErrorBoundary sectionName="App">
          {children}
        </ErrorBoundary>
        <Footer />
      </main>
      <TabBar />
      <ScrollToTop />
    </>
  );
}
