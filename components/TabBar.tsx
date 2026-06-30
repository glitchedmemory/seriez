"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function TabBar() {
  const t = useTranslations();
  const pathname = usePathname();

  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      const username = data.user?.user_metadata?.username;
      // Optimistic: show admin button immediately if username matches
      if (username === "Seriez") setIsStaff(true);
      if (username) {
        fetch(`/api/admin/users?username=${encodeURIComponent(username)}`)
          .then(r => r.json())
          .then(d => {
            if (d.users?.length > 0) {
              const role = d.users[0].role;
              setIsStaff(role === "admin" && username === "Seriez");
            } else {
              setIsStaff(false);
            }
          })
          .catch(() => {});
      }
    }).catch(() => {});

    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const tabs: { name: string; icon: ReactNode; path: string }[] = [
    { name: t("nav.home"), icon: <Image src="/icons/home.png" alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} />, path: "/" },
    { name: t("nav.search"), icon: <Image src="/icons/search.png" alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} />, path: "/search" },
    { name: t("nav.myList"), icon: <Image src="/icons/library.png" alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} />, path: "/library" },
    { name: t("nav.feed"), icon: <Image src="/icons/feed.png" alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} unoptimized />, path: "/feed" },
    { name: t("nav.profile"), icon: <Image src="/icons/profile.png" alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} />, path: "/profile" },
  ];

  if (pathname === "/onboarding") return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-primary/95 backdrop-blur-md border-t border-[#1a1a2e]">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = pathname === tab.path || (tab.path === "/admin" && pathname.startsWith("/admin"));
          return (
            <a
              key={tab.name}
              href={tab.path}
              aria-label={tab.name}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                active ? "text-accent-light" : "text-text-secondary hover:text-white light:hover:text-accent"
              }`}
            >
              <span className={`text-xl ${active ? "[&>img]:filter [&>img]:brightness-0 [&>img]:saturate-100 [&>img]:invert-[33%] [&>img]:sepia-[54%] [&>img]:saturate-[2050%] [&>img]:hue-rotate-[245deg] [&>img]:brightness-[.95] [&>img]:contrast-[.93]" : ""}`}>
                {tab.icon}
              </span>
              <span className="font-medium">{tab.name}</span>
            </a>
          );
        })}
        {isStaff && (
          <a
            href="/admin"
            className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
              pathname.startsWith("/admin") ? "text-accent-light" : "text-text-secondary hover:text-white"
            }`}
          >
            <span className="text-xl">⚙</span>
            <span className="font-medium">Admin</span>
          </a>
        )}
      </div>
    </nav>
  );
}

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      const username = data.user?.user_metadata?.username;
      // Optimistic: show admin button immediately if username matches
      if (username === "Seriez") setIsStaff(true);
      if (username) {
        fetch(`/api/admin/users?username=${encodeURIComponent(username)}`)
          .then(r => r.json())
          .then(d => {
            if (d.users?.length > 0) {
              const role = d.users[0].role;
              setIsStaff(role === "admin" && username === "Seriez");
            } else {
              setIsStaff(false);
            }
          })
          .catch(() => {});
      }
    }).catch(() => {
      setMounted(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch avatar URL when user is known
  useEffect(() => {
    let u: string | null | undefined = user?.user_metadata?.username;
    // Fallback: check localStorage + cookie only when user exists (login may not populate metadata)
    if (!u && user) {
      u = localStorage.getItem("seriez-username");
      if (!u) {
        const match = document.cookie.match(/(?:^| )seriez-username=([^;]+)/);
        if (match) {
          u = decodeURIComponent(match[1]);
          localStorage.setItem("seriez-username", u);
        }
      }
    }
    if (!u) return;
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=avatar_url&username=eq.${encodeURIComponent(u)}`;
    fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    })
      .then((r) => r.json())
      .then((rows) => setAvatarUrl(rows[0]?.avatar_url || null))
      .catch(() => {});
  }, [user]);

  if (pathname === "/onboarding") return null;

  const displayName = user?.user_metadata?.username || user?.email?.split("@")[0] || t("auth.guest");
  const initial = displayName.slice(0, 1).toUpperCase();

  const tabs: { name: string; icon: ReactNode; path: string }[] = [
    { name: t("nav.home"), icon: <Image src="/icons/home.png" alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} />, path: "/" },
    { name: t("nav.search"), icon: <Image src="/icons/search.png" alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} />, path: "/search" },
    { name: t("nav.myList"), icon: <Image src="/icons/library.png" alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} />, path: "/library" },
    { name: t("nav.feed"), icon: <Image src="/icons/feed.png" alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} unoptimized />, path: "/feed" },
    { name: t("nav.profile"), icon: <Image src="/icons/profile.png" alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} />, path: "/profile" },
  ];

  return (
    <aside className="hidden md:flex flex-col h-screen sticky top-0 border-r border-[#1a1a2e] px-3 py-6 transition-all duration-200 w-14 hover:w-56 group overflow-hidden hover:overflow-visible z-50 bg-bg-primary">
      <Link
        href="/"
        className="flex items-center gap-3 px-1.5 py-2.5 rounded-lg mb-6 hover:bg-bg-card transition-colors min-w-max"
      >
        <span className="text-xl flex-shrink-0">🎬</span>
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Seriez
        </h1>
      </Link>

      <nav className="flex flex-col gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.path || (tab.path === "/admin" && pathname.startsWith("/admin"));
          return (
            <a
              key={tab.name}
              href={tab.path}
              aria-label={tab.name}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-1.5 py-2.5 rounded-lg text-sm font-medium transition-all min-w-max ${
                active
                  ? "bg-accent/10 text-text-primary"
                  : "text-text-secondary hover:text-white light:hover:text-accent hover:bg-bg-card"
              }`}
            >
              <span className="text-lg flex-shrink-0">{tab.icon}</span>
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">{tab.name}</span>
            </a>
          );
        })}
        {isStaff && (
          <a
            href="/admin"
            className={`flex items-center gap-3 px-1.5 py-2.5 rounded-lg text-sm font-medium transition-all min-w-max ${
              pathname.startsWith("/admin")
                ? "bg-accent/10 text-text-primary"
                : "text-text-secondary hover:text-white hover:bg-bg-card"
            }`}
          >
            <span className="text-lg flex-shrink-0">⚙</span>
            <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">Admin</span>
          </a>
        )}
      </nav>

      <div className="mt-auto pt-6 border-t border-[#1a1a2e]">
        {!mounted ? (
          <div className="flex items-center gap-3 px-1.5 py-2 min-w-max">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0" />
          </div>
        ) : user ? (
          <>
          <a href="/profile" className="flex items-center gap-3 px-1.5 py-2 min-w-max">
            <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <img src="/icons/default-avatar.png" alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            )}
            </div>
            <div className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <p className="text-sm font-medium text-text-primary">{displayName}</p>
            </div>
          </a>
          <button
            onClick={async () => { await supabase.auth.signOut(); localStorage.removeItem("seriez-username"); window.location.href = "/"; }}
            className="flex items-center gap-3 px-1.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-red-400 transition-colors min-w-max"
          >
            <span className="text-sm flex-shrink-0 ml-[0.3rem]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </span>
            <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">{t("auth.signOut")}</span>
          </button>
          </>
        ) : (
          <a href="/login" className="flex items-center gap-3 px-1.5 py-2 min-w-max">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-text-primary">G</span>
            </div>
            <div className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <p className="text-sm font-medium text-text-primary">{t("auth.guest")}</p>
              <p className="text-xs text-text-secondary">{t("auth.signIn")} →</p>
            </div>
          </a>
        )}
      </div>
    </aside>
  );
}
