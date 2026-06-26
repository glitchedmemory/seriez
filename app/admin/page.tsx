import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { count: totalUsers } = await supabase
    .from("users").select("*", { count: "exact", head: true });

  const { count: premiumUsers } = await supabase
    .from("users").select("*", { count: "exact", head: true })
    .eq("is_premium", true);

  const { count: openReports } = await supabase
    .from("reports").select("*", { count: "exact", head: true });

  const { count: sanctionedUsers } = await supabase
    .from("users").select("*", { count: "exact", head: true })
    .not("sanction_type", "is", null);

  const stats = [
    {
      label: "Total Users",
      value: totalUsers ?? 0,
      href: "/admin/users",
      accent: "#6366f1",
      bg: "from-[#6366f1]/10 to-[#6366f1]/5",
      border: "border-[#6366f1]/20",
    },
    {
      label: "Premium",
      value: premiumUsers ?? 0,
      href: "/admin/users",
      accent: "#f59e0b",
      bg: "from-[#f59e0b]/10 to-[#f59e0b]/5",
      border: "border-[#f59e0b]/20",
    },
    {
      label: "Sanctioned",
      value: sanctionedUsers ?? 0,
      href: "/admin/reports?tab=sanctions",
      accent: "#ef4444",
      bg: "from-[#ef4444]/10 to-[#ef4444]/5",
      border: "border-[#ef4444]/20",
    },
    {
      label: "Open Reports",
      value: openReports ?? 0,
      href: "/admin/reports",
      accent: "#f97316",
      bg: "from-[#f97316]/10 to-[#f97316]/5",
      border: "border-[#f97316]/20",
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-[#71717a] mt-1">Overview of your platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`relative overflow-hidden rounded-2xl border ${s.border} bg-gradient-to-br ${s.bg} p-5 hover:scale-[1.02] transition-transform duration-200`}
          >
            <div className="relative z-10">
              <p className="text-3xl font-bold text-white tracking-tight">{s.value.toLocaleString()}</p>
              <p className="text-xs text-[#a1a1aa] mt-1 font-medium">{s.label}</p>
            </div>
            <div
              className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-20"
              style={{ background: s.accent }}
            />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/admin/users"
          className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-6 hover:border-[#6366f1]/30 transition-all duration-200 group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-4 group-hover:bg-[#6366f1]/20 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-white mb-1">User Management</h3>
          <p className="text-xs text-[#71717a] leading-relaxed">View, search, and manage user accounts, roles, and permissions</p>
        </Link>

        <Link
          href="/admin/reports"
          className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-6 hover:border-[#f97316]/30 transition-all duration-200 group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#f97316]/10 flex items-center justify-center mb-4 group-hover:bg-[#f97316]/20 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </div>
          <h3 className="font-semibold text-white mb-1">Content Moderation</h3>
          <p className="text-xs text-[#71717a] leading-relaxed">Review reported content, hide or delete items</p>
        </Link>

        <Link
          href="/admin/reports?tab=audit"
          className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-6 hover:border-[#a855f7]/30 transition-all duration-200 group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#a855f7]/10 flex items-center justify-center mb-4 group-hover:bg-[#a855f7]/20 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="font-semibold text-white mb-1">Audit Log</h3>
          <p className="text-xs text-[#71717a] leading-relaxed">Track all admin actions and moderation history</p>
        </Link>
      </div>
    </div>
  );
}
