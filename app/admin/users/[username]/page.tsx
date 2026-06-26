"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface UserDetail {
  user: {
    username: string;
    role: string;
    is_premium: boolean;
    created_at: string;
    avatar_url?: string;
    sanction_type?: string | null;
    sanction_reason?: string | null;
    sanction_until?: string | null;
    sanctioned_at?: string | null;
    sanctioned_by?: string | null;
    episode_watch_count?: number;
  };
  reviews: any[];
  library: any[];
  comments: any[];
}

export default function AdminUserDetailPage() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  useEffect(() => {
    fetch(`/api/admin/user-detail?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, [username]);

  async function togglePremium() {
    if (!data) return;
    setActionLoading("premium");
    const newVal = !data.user.is_premium;
    const r = await fetch("/api/admin/users/premium", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, premium: newVal }),
    });
    const d = await r.json();
    if (d.ok) setData({ ...data, user: { ...data.user, is_premium: newVal } });
    else alert(d.error || "Failed");
    setActionLoading("");
  }

  async function changeRole(newRole: string) {
    if (!data) return;
    setActionLoading("role");
    const r = await fetch("/api/admin/users/role", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, role: newRole }),
    });
    const d = await r.json();
    if (d.ok) setData({ ...data, user: { ...data.user, role: newRole } });
    else alert(d.error || "Failed");
    setActionLoading("");
  }

  if (loading) return <div className="p-8"><p className="text-sm text-[#71717a]">Loading...</p></div>;
  if (error || !data) return <div className="p-8"><p className="text-sm text-[#ef4444]">{error || "Not found"}</p></div>;

  const { user, reviews, library, comments } = data;

  return (
    <div className="p-8">
      <Link href="/admin/users" className="text-sm text-[#71717a] hover:text-white transition-colors mb-6 inline-block">
        ← Back to Users
      </Link>

      <div className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">{user.username}</h1>
            <p className="text-sm text-[#71717a] mt-1">
              Joined {new Date(user.created_at).toLocaleDateString()} · {reviews.length} reviews · {library.length} tracked · {comments.length} comments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              user.role === "admin" ? "bg-[#ef4444]/10 text-[#ef4444]" :
              user.role === "moderator" ? "bg-[#3b82f6]/10 text-[#3b82f6]" :
              "bg-[#1a1a2e] text-[#a1a1aa]"
            }`}>{user.role}</span>
            {user.is_premium ? (
              <span className="text-[11px] bg-[#f59e0b]/10 text-[#f59e0b] px-2 py-0.5 rounded-full font-medium">Gold</span>
            ) : (
              <span className="text-[11px] bg-[#1a1a2e] text-[#52525b] px-2 py-0.5 rounded-full">Free</span>
            )}
          </div>
        </div>

        {user.sanction_type && (
          <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 mb-4">
            <p className="text-sm text-[#ef4444] font-medium">Currently sanctioned: {user.sanction_type}</p>
            {user.sanction_reason && <p className="text-xs text-[#71717a] mt-1">Reason: {user.sanction_reason}</p>}
            {user.sanction_until && <p className="text-xs text-[#71717a]">Until: {new Date(user.sanction_until).toLocaleString()}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={togglePremium} disabled={actionLoading === "premium"}
            className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
              user.is_premium
                ? "bg-[#1a1a2e] hover:bg-[#2a2a45] text-[#a1a1aa]"
                : "bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 text-[#f59e0b]"
            }`}>
            {actionLoading === "premium" ? "..." : user.is_premium ? "Revoke Golden Ticket" : "Grant Golden Ticket"}
          </button>

          {user.role === "user" && (
            <button onClick={() => changeRole("moderator")} disabled={actionLoading === "role"}
              className="text-xs bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 text-[#3b82f6] px-4 py-2 rounded-lg font-medium transition-colors">
              {actionLoading === "role" ? "..." : "Promote to Moderator"}
            </button>
          )}
          {user.role === "moderator" && (
            <button onClick={() => changeRole("user")} disabled={actionLoading === "role"}
              className="text-xs bg-[#1a1a2e] hover:bg-[#2a2a45] text-[#a1a1aa] px-4 py-2 rounded-lg font-medium transition-colors">
              {actionLoading === "role" ? "..." : "Demote to User"}
            </button>
          )}
        </div>
      </div>

      {reviews.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-white mb-3">Recent Reviews</h2>
          <div className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] divide-y divide-[#1a1a2e]/50">
            {reviews.slice(0, 10).map((r: any) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-[#f59e0b]">{"★".repeat(Math.min(5, Math.round(r.rating || 0)))}</span>
                  <span className="text-xs text-[#52525b]">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-[#d4d4d8] line-clamp-2">{r.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {library.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Recent Trackings</h2>
          <div className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] divide-y divide-[#1a1a2e]/50">
            {library.slice(0, 10).map((t: any, i: number) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-[#a1a1aa]">TMDB {t.tmdb_id} · {t.media_type}</span>
                <span className="text-xs text-[#52525b]">{t.status} {t.rating ? `· ★${t.rating}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
