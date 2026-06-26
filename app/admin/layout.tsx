"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<"loading" | "yes" | "no">("loading");
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) { router.push("/login"); return; }
      const uname = user.user_metadata?.username;
      if (uname) {
        setUsername(uname);
        supabase.from("users").select("role").eq("username", uname).maybeSingle().then(
          ({ data: row }) => {
            const r = (row as any)?.role;
            if (r === "admin" || r === "moderator") { setRole(r); setAuthorized("yes"); }
            else { router.push("/"); }
          },
          () => { router.push("/"); }
        );
      } else { router.push("/"); }
    });
  }, []);

  if (authorized === "loading") return <div className="min-h-screen bg-[#08080f] flex items-center justify-center"><p className="text-[#71717a] text-sm">Checking access...</p></div>;
  if (authorized === "no") return null;

  const isAdmin = role === "admin";

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { href: "/admin/users", label: "Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    { href: "/admin/reports", label: "Reports", icon: "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" },
  ];

  if (isAdmin) {
    navItems.push(
      { href: "/admin/reports?tab=sanctions", label: "Sanctions", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" },
      { href: "/admin/reports?tab=audit", label: "Audit Log", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
    );
  }

  return (
    <div className="min-h-screen bg-[#08080f] flex">
      <aside className="w-56 shrink-0 border-r border-[#1a1a2e] bg-[#0a0a14] flex flex-col">
        <div className="px-5 py-5 border-b border-[#1a1a2e]">
          <Link href="/" className="text-base font-bold tracking-tight text-white">
            seriez<span className="text-[#6366f1]"> admin</span>
          </Link>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              isAdmin ? "bg-[#ef4444]/15 text-[#ef4444]" : "bg-[#3b82f6]/15 text-[#3b82f6]"
            }`}>{role}</span>
            <span className="text-[11px] text-[#71717a]">{username}</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                pathname === item.href || (item.href.includes("?tab=") && pathname + (typeof window !== "undefined" ? window.location.search : "") === item.href)
                  ? "text-white bg-[#1a1a2e]"
                  : "text-[#a1a1aa] hover:text-white hover:bg-[#1a1a2e]"
              }`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-[#1a1a2e]">
          <Link href="/" className="text-xs text-[#71717a] hover:text-[#a1a1aa] transition-colors">← Back to site</Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
