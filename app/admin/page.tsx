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
    .from("reports").select("*", { count: "exact", head: true })
    .eq("status", "open");

  const stats = [
    { label: "Total Users", value: totalUsers ?? 0, href: "/admin/users" },
    { label: "Premium Users", value: premiumUsers ?? 0, href: "/admin/users?filter=premium" },
    { label: "Open Reports", value: openReports ?? 0, href: "/admin/reports" },
  ];

  return (
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-text-primary mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="bg-bg-card border border-border rounded-xl p-6 hover:border-accent/40 transition-colors"
            >
              <p className="text-3xl font-bold text-text-primary mb-1">{s.value}</p>
              <p className="text-sm text-text-secondary">{s.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/admin/users"
            className="bg-bg-card border border-border rounded-xl p-6 hover:border-accent/40 transition-colors"
          >
            <h3 className="font-semibold text-text-primary mb-1">User Management</h3>
            <p className="text-sm text-text-secondary">View all users, manage roles and premium status</p>
          </Link>
          <Link
            href="/admin/reports"
            className="bg-bg-card border border-border rounded-xl p-6 hover:border-accent/40 transition-colors"
          >
            <h3 className="font-semibold text-text-primary mb-1">Reports</h3>
            <p className="text-sm text-text-secondary">Review and moderate reported content</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
