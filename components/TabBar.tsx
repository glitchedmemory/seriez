"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const tabs: { name: string; icon: ReactNode; path: string }[] = [
  {
    name: "Home",
    icon: <Image src="/icons/home.png" alt="Home" width={24} height={24} style={{ imageRendering: "pixelated" }} />,
    path: "/",
  },
  { name: "Search", icon: <Image src="/icons/search.png" alt="Search" width={24} height={24} style={{ imageRendering: "pixelated" }} />, path: "/search" },
  { name: "My List", icon: <Image src="/icons/library.png" alt="My List" width={24} height={24} style={{ imageRendering: "pixelated" }} />, path: "/library" },
  {
    name: "Feed",
    icon: <Image src="/icons/feed.png" alt="Feed" width={24} height={24} style={{ imageRendering: "pixelated" }} />,
    path: "/feed",
  },
  {
    name: "Profile",
    icon: <Image src="/icons/profile.png" alt="Profile" width={24} height={24} style={{ imageRendering: "pixelated" }} />,
    path: "/profile",
  },
];

export default function TabBar() {
  const pathname = usePathname();
  if (pathname === "/onboarding") return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f1a]/95 backdrop-blur-md border-t border-[#1a1a2e]">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = pathname === tab.path;
          return (
            <a
              key={tab.name}
              href={tab.path}
              aria-label={tab.name}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                active ? "text-[#a855f7]" : "text-[#9ca3af] hover:text-white"
              }`}
            >
              <span className={`text-xl ${active && tab.name !== "Feed" ? "[&>img]:filter [&>img]:brightness-0 [&>img]:saturate-100 [&>img]:invert-[33%] [&>img]:sepia-[54%] [&>img]:saturate-[2050%] [&>img]:hue-rotate-[245deg] [&>img]:brightness-[.95] [&>img]:contrast-[.93]" : ""}`}>
                {tab.icon}
              </span>
              <span className="font-medium">{tab.name}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    }).catch(() => {
      setMounted(true);
    });
  }, []);

  // Fetch avatar URL when user is known
  useEffect(() => {
    let u: string | null | undefined = user?.user_metadata?.username;
    // Fallback: check localStorage + cookie (login doesn't populate metadata)
    if (!u) {
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

  const displayName = user?.user_metadata?.username || user?.email?.split("@")[0] || "Guest";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <aside className="hidden md:flex flex-col h-screen sticky top-0 border-r border-[#1a1a2e] px-3 py-6 transition-all duration-200 w-14 hover:w-56 group overflow-hidden hover:overflow-visible z-50 bg-[#0f0f1a]">
      <Link
        href="/"
        className="flex items-center gap-3 px-1.5 py-2.5 rounded-lg mb-6 hover:bg-[#1a1a2e] transition-colors min-w-max"
      >
        <span className="text-xl flex-shrink-0">🎬</span>
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Seriez
        </h1>
      </Link>

      <nav className="flex flex-col gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.path;
          return (
            <a
              key={tab.name}
              href={tab.path}
              aria-label={tab.name}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-1.5 py-2.5 rounded-lg text-sm font-medium transition-all min-w-max ${
                active
                  ? "bg-[#6366f1]/10 text-white"
                  : "text-[#9ca3af] hover:text-white hover:bg-[#1a1a2e]"
              }`}
            >
              <span className="text-lg flex-shrink-0">{tab.icon}</span>
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">{tab.name}</span>
            </a>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-[#1a1a2e]">
        {!mounted ? (
          <div className="flex items-center gap-3 px-1.5 py-2 min-w-max">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0" />
          </div>
        ) : user ? (
          <a href="/profile" className="flex items-center gap-3 px-1.5 py-2 min-w-max">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">{initial}</span>
              </div>
            )}
            <div className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <p className="text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-[#9ca3af]">Profile →</p>
            </div>
          </a>
        ) : (
          <a href="/login" className="flex items-center gap-3 px-1.5 py-2 min-w-max">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">G</span>
            </div>
            <div className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <p className="text-sm font-medium text-white">Guest</p>
              <p className="text-xs text-[#9ca3af]">Sign in →</p>
            </div>
          </a>
        )}
      </div>
    </aside>
  );
}
