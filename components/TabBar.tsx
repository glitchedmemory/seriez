"use client";

import { usePathname } from "next/navigation";

const tabs = [
  { name: "Home", icon: "🏠", path: "/" },
  { name: "Search", icon: "🔍", path: "/search" },
  { name: "Library", icon: "📚", path: "/library" },
  { name: "Profile", icon: "👤", path: "/profile" },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f1a]/95 backdrop-blur-md border-t border-[#1a1a2e]">
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
