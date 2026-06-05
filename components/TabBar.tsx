"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const tabs = [
  { name: "Home", icon: "🏠", path: "/" },
  { name: "Search", icon: "🔍", path: "/search" },
  { name: "Library", icon: "📚", path: "/library" },
  { name: "Profile", icon: "👤", path: "/profile" },
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
              className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                active ? "text-[#a855f7]" : "text-[#9ca3af] hover:text-white"
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
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
  if (pathname === "/onboarding") return null;

  return (
    <aside className="hidden md:flex flex-col h-screen sticky top-0 border-r border-[#1a1a2e] px-3 py-6 transition-all duration-200 w-14 hover:w-56 group overflow-hidden hover:overflow-visible z-50 bg-[#0f0f1a]">
      <Link
        href="/"
        className="flex items-center gap-3 px-1.5 py-2.5 rounded-lg mb-6 hover:bg-[#1a1a2e] transition-colors min-w-max"
      >
        <span className="text-xl flex-shrink-0">🎬</span>
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Reelist
        </h1>
      </Link>

      <nav className="flex flex-col gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.path;
          return (
            <a
              key={tab.name}
              href={tab.path}
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
        <div className="flex items-center gap-3 px-1.5 py-2 min-w-max">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">G</span>
          </div>
          <div className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <p className="text-sm font-medium text-white">Guest</p>
            <p className="text-xs text-[#9ca3af]">Sign in</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
