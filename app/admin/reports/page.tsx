"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface HiddenItem {
  type: "review" | "comment";
  id: string | number;
  username: string;
  content: string;
  ai_verdict?: string;
  created_at: string;
  tmdb_id?: number;
  media_type?: string;
  review_id?: string;
}

interface UserInfo {
  username: string;
  role: string;
  is_premium: boolean;
  created_at: string;
  sanction_type?: string | null;
  sanction_until?: string | null;
  sanctioned_at?: string | null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function AdminReportsPage() {
  const [items, setItems] = useState<HiddenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [verdicts, setVerdicts] = useState<Record<string, string>>({});
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [section, setSection] = useState<"reports" | "users" | "sanctions">("reports");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [sanctionType, setSanctionType] = useState("warned");
  const [sanctionReason, setSanctionReason] = useState("");
  const [sanctionDuration, setSanctionDuration] = useState(24);
  const [sanctioning, setSanctioning] = useState(false);
  const [sanctionMsg, setSanctionMsg] = useState("");

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      const username = user?.user_metadata?.username;
      if (username) {
        supabase.from("users").select("role").eq("username", username).maybeSingle()
          .then(
            ({ data: rows }) => setIsAdmin((rows as any)?.role === "admin"),
            () => setIsAdmin(false)
          );
      } else {
        setIsAdmin(false);
      }
    });
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        const data = await res.json();
        const all: HiddenItem[] = [
          ...(data.reviews || []).map((r: any) => ({ ...r, type: "review" as const })),
          ...(data.comments || []).map((c: any) => ({ ...c, type: "comment" as const })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setItems(all);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {}
    setUsersLoading(false);
  };

  useEffect(() => {
    if (isAdmin && (section === "users" || section === "sanctions") && users.length === 0) {
      fetchUsers();
    }
  }, [isAdmin, section]);

  const handleAction = async (item: HiddenItem, action: "restore" | "delete") => {
    const targetId = String(item.id);
    const res = await fetch("/api/admin/reports?action=${action}&target_type=${item.type}&target_id=${targetId}");
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id || i.type !== item.type));
    }
  };

  const handleAnalyze = async (item: HiddenItem) => {
    const key = "${item.type}-${item.id}";
    setAnalyzingId(key);
    try {
      const res = await fetch("/api/admin/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: item.content, target_type: item.type, target_id: String(item.id) }),
      });
      if (res.ok) {
        const data = await res.json();
        setVerdicts((prev) => ({ ...prev, [key]: data.verdict }));
      }
    } catch {}
    setAnalyzingId(null);
  };

  async function applySanction() {
    if (!selectedUser) return;
    setSanctioning(true); setSanctionMsg("");
    try {
      const res = await fetch("/api/admin/sanction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedUser,
          sanction_type: sanctionType,
          reason: sanctionReason || undefined,
          duration_hours: sanctionType === "suspended" ? sanctionDuration : undefined,
        }),
      });
      if (res.ok) {
        setSanctionMsg("Sanction applied to " + selectedUser);
        setSelectedUser(""); setSanctionReason("");
        fetchUsers();
      } else {
        const d = await res.json();
        setSanctionMsg(d.error);
      }
    } catch { setSanctionMsg("Failed"); }
    setSanctioning(false);
  }

  async function removeSanction() {
    if (!selectedUser) return;
    setSanctioning(true); setSanctionMsg("");
    try {
      const res = await fetch("/api/admin/sanction", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: selectedUser }),
      });
      if (res.ok) {
        setSanctionMsg("Sanction removed from " + selectedUser);
        setSelectedUser(""); fetchUsers();
      } else {
        const d = await res.json();
        setSanctionMsg(d.error);
      }
    } catch { setSanctionMsg("Failed"); }
    setSanctioning(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-text-primary p-6">
      {isAdmin === null ? (
        <p className="text-text-secondary">Checking access...</p>
      ) : isAdmin === false ? (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-6 text-center">
          <p className="text-red-400 text-lg font-semibold mb-2">Access Denied</p>
          <p className="text-text-secondary text-sm">Admin privileges required to view this page.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-6">
            <h1 className="text-2xl font-bold">🛡️ Admin</h1>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as "reports" | "users" | "sanctions")}
              className="bg-bg-card text-text-primary text-sm rounded-xl px-3 py-2 border border-border focus:border-accent outline-none"
            >
              <option value="reports">🚨 Reports</option>
              <option value="users">👥 Users</option>
              <option value="sanctions">⛔ Sanctions</option>
            </select>
          </div>

          {section === "reports" ? (
            <>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              {loading ? (
                <p className="text-text-secondary">Loading...</p>
              ) : items.length === 0 ? (
                <p className="text-text-secondary">No hidden content. Clean! ✅</p>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
            const key = "${item.type}-${item.id}";
            const verdict = verdicts[key] || item.ai_verdict;
            return (
              <div key={key} className="bg-bg-card rounded-xl p-4 border border-red-800/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded">
                      {item.type === "review" ? "📝 Review" : "💬 Comment"}
                    </span>
                    <span className="text-xs text-text-secondary">{item.username}</span>
                    <span className="text-xs text-text-secondary">{formatDate(item.created_at)}</span>
                    {(item as any).report_count >= 5 && (
                      <span className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full font-bold">
                        🚩 {(item as any).report_count}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAnalyze(item)}
                      disabled={analyzingId === key}
                      className="text-xs px-2 py-1 bg-blue-600/30 text-blue-300 rounded hover:bg-blue-600/50 disabled:opacity-50"
                    >
                      {analyzingId === key ? "Analyzing..." : "🔍 Analyze"}
                    </button>
                    <button
                      onClick={() => handleAction(item, "restore")}
                      className="text-xs px-2 py-1 bg-green-600/30 text-green-300 rounded hover:bg-green-600/50"
                    >
                      ✅ Restore
                    </button>
                    <button
                      onClick={() => handleAction(item, "delete")}
                      className="text-xs px-2 py-1 bg-red-600/30 text-red-300 rounded hover:bg-red-600/50"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
                <p className="text-sm text-[#d1d5db] light:text-text-primary bg-bg-surface p-3 rounded-lg whitespace-pre-wrap">
                  {item.content}
                </p>
                {verdict && (
                  <div className={"mt-2 text-xs p-2 rounded ${
                    verdict.includes("DELETE")
                      ? "bg-red-900/30 text-red-300"
                      : verdict.includes("RESTORE")
                      ? "bg-green-900/30 text-green-300"
                      : "bg-yellow-900/30 text-yellow-300"
                  }"}>
                    🤖 {verdict}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
            </>
          ) : section === "sanctions" ? (
            /* Sanctions section */
            <>
              <div className="bg-bg-card rounded-xl p-5 border border-border max-w-lg">
                <h3 className="text-text-primary font-semibold mb-4">Apply Sanction</h3>
                <label className="block text-xs text-text-secondary mb-1">User</label>
                <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="w-full bg-bg-surface text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-accent outline-none mb-3">
                  <option value="">Select user...</option>
                  {users.filter(u => u.role !== "admin").map((u) => (<option key={u.username} value={u.username}>{u.username}</option>))}
                </select>
                <label className="block text-xs text-text-secondary mb-1">Type</label>
                <select value={sanctionType} onChange={(e) => setSanctionType(e.target.value)} className="w-full bg-bg-surface text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-accent outline-none mb-3">
                  <option value="warned">⚠️ Warning</option>
                  <option value="suspended">⏸️ Temporary Suspension</option>
                  <option value="banned">🚫 Permanent Ban</option>
                  <option value="comment_restricted">💬 Comment Restriction</option>
                </select>
                {sanctionType === "suspended" && (
                  <><label className="block text-xs text-text-secondary mb-1">Duration (hours)</label>
                  <input type="number" value={sanctionDuration} onChange={(e) => setSanctionDuration(parseInt(e.target.value) || 24)} min={1} max={720} className="w-full bg-bg-surface text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-accent outline-none mb-3" /></>
                )}
                <label className="block text-xs text-text-secondary mb-1">Reason</label>
                <input type="text" value={sanctionReason} onChange={(e) => setSanctionReason(e.target.value)} placeholder="e.g. Repeated spam in reviews" className="w-full bg-bg-surface text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-accent outline-none mb-4" />
                <button onClick={applySanction} disabled={!selectedUser || sanctioning} className="w-full py-2 text-sm font-medium bg-red-600/20 text-red-400 border border-red-800/40 rounded-lg hover:bg-red-600/30 disabled:opacity-40 transition-colors mb-2">
                  {sanctioning ? "Applying..." : "Apply Sanction"}
                </button>
                <button onClick={removeSanction} disabled={!selectedUser || sanctioning} className="w-full py-2 text-sm font-medium bg-green-600/20 text-green-400 border border-green-800/40 rounded-lg hover:bg-green-600/30 disabled:opacity-40 transition-colors">
                  Remove Sanction
                </button>
                {sanctionMsg && <p className={"text-xs mt-3 " + (sanctionMsg.startsWith("Sanction") ? "text-green-400" : "text-red-400")}>{sanctionMsg}</p>}
              </div>
            </>
          ) : (
            /* Users section */
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-text-secondary">{users.length} users</p>
                <button
                  onClick={fetchUsers}
                  className="text-xs px-3 py-1.5 bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>
              {usersLoading ? (
                <p className="text-text-secondary">Loading...</p>
              ) : users.length === 0 ? (
                <p className="text-text-secondary">No users found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wide">
                        <th className="text-left py-2 px-3">Username</th>
                        <th className="text-left py-2 px-3">Role</th>
                        <th className="text-left py-2 px-3">Status</th>
                        <th className="text-left py-2 px-3">Premium</th>
                        <th className="text-left py-2 px-3">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.username} className={"border-b border-border/50 " + (i % 2 === 0 ? "bg-bg-card/30" : "")}>
                          <td className="py-2 px-3 font-medium">{u.username}</td>
                          <td className="py-2 px-3">
                            <span className={"text-xs px-2 py-0.5 rounded-full " + (u.role === "admin" ? "bg-red-900/30 text-red-300" : "bg-bg-card text-text-secondary")}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {u.sanction_type ? (
                              <span className="text-xs bg-red-900/30 text-red-300 px-2 py-0.5 rounded-full">{u.sanction_type}</span>
                            ) : (
                              <span className="text-xs text-green-400">✓</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {u.is_premium ? (
                              <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full">⭐ Yes</span>
                            ) : (
                              <span className="text-xs text-text-secondary">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-text-secondary text-xs">{formatDate(u.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
