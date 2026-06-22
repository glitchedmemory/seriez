"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  const router = useRouter();
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, premium: newVal }),
    });
    const d = await r.json();
    if (d.ok) {
      setData({
        ...data,
        user: { ...data.user, is_premium: newVal },
      });
    } else {
      alert(d.error || "Failed");
    }
    setActionLoading("");
  }

  async function changeRole(newRole: string) {
    if (!data) return;
    setActionLoading("role");
    const r = await fetch("/api/admin/users/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, role: newRole }),
    });
    const d = await r.json();
    if (d.ok) {
      setData({
        ...data,
        user: { ...data.user, role: newRole },
      });
    } else {
      alert(d.error || "Failed");
    }
    setActionLoading("");
  }

  async function removeSanction() {
    if (!data) return;
    setActionLoading("sanction");
    const r = await fetch("/api/admin/sanction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        action: "remove",
      }),
    });
    const d = await r.json();
    if (d.ok) {
      setData({
        ...data,
        user: { ...data.user, sanction_type: null, sanction_reason: null, sanction_until: null, sanctioned_at: null, sanctioned_by: null },
      });
    } else {
      alert(d.error || "Failed");
    }
    setActionLoading("");
  }

  if (loading) return <div className="flex-1 bg-bg-primary flex items-center justify-center"><p className="text-text-secondary">Loading...</p></div>;
  if (error || !data) return <div className="flex-1 bg-bg-primary flex items-center justify-center"><p className="text-red-400">{error || "Not found"}</p></div>;

  const { user, reviews, library, comments } = data;

  return (
    <div className="flex-1 bg-bg-primary">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/admin/users" className="text-sm text-text-secondary hover:text-text-primary transition-colors mb-4 inline-block">
          ← Back to Users
        </Link>

        <div className="bg-bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-text-primary">{user.username}</h1>
              <p className="text-sm text-text-secondary mt-1">
                Joined {new Date(user.created_at).toLocaleDateString()} · {reviews.length} reviews · {library.length} tracked · {comments.length} comments
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                user.role === "admin" ? "bg-red-500/10 text-red-400" :
                user.role === "moderator" ? "bg-blue-500/10 text-blue-400" :
                "bg-bg-surface text-text-secondary"
              }`}>
                {user.role}
              </span>
              {user.is_premium ? (
                <span className="text-xs bg-gold/10 text-gold px-2 py-1 rounded-full">★ Gold</span>
              ) : (
                <span className="text-xs bg-bg-surface text-text-secondary px-2 py-1 rounded-full">Free</span>
              )}
            </div>
          </div>

          {/* Sanction info */}
          {user.sanction_type && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-400 font-medium">Currently sanctioned: {user.sanction_type}</p>
              {user.sanction_reason && <p className="text-xs text-text-secondary mt-1">Reason: {user.sanction_reason}</p>}
              {user.sanction_until && <p className="text-xs text-text-secondary">Until: {new Date(user.sanction_until).toLocaleString()}</p>}
              <button
                onClick={removeSanction}
                disabled={actionLoading === "sanction"}
                className="mt-2 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                {actionLoading === "sanction" ? "..." : "Remove Sanction"}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={togglePremium}
              disabled={actionLoading === "premium"}
              className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
                user.is_premium
                  ? "bg-bg-surface hover:bg-bg-surface/80 text-text-secondary"
                  : "bg-gold/10 hover:bg-gold/20 text-gold"
              }`}
            >
              {actionLoading === "premium" ? "..." : user.is_premium ? "Revoke Golden Ticket" : "Grant Golden Ticket"}
            </button>

            {user.role === "user" && (
              <button
                onClick={() => changeRole("moderator")}
                disabled={actionLoading === "role"}
                className="text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {actionLoading === "role" ? "..." : "Promote to Moderator"}
              </button>
            )}
            {user.role === "moderator" && (
              <button
                onClick={() => changeRole("user")}
                disabled={actionLoading === "role"}
                className="text-xs bg-bg-surface hover:bg-bg-surface/80 text-text-secondary px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {actionLoading === "role" ? "..." : "Demote to User"}
              </button>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-6">
          {reviews.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary mb-3">Recent Reviews</h2>
              <div className="bg-bg-card border border-border rounded-xl divide-y divide-border/50">
                {reviews.slice(0, 10).map((r: any) => (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gold">{"★".repeat(Math.min(5, Math.round(r.rating || 0)))}</span>
                      <span className="text-xs text-text-secondary">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-text-primary line-clamp-2">{r.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {library.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary mb-3">Recent Trackings</h2>
              <div className="bg-bg-card border border-border rounded-xl divide-y divide-border/50">
                {library.slice(0, 10).map((t: any, i: number) => (
                  <div key={i} className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-text-primary">TMDB {t.tmdb_id} · {t.media_type}</span>
                    <span className="text-xs text-text-secondary">{t.status} {t.rating ? `· ★${t.rating}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
