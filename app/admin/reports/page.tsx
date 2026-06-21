"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface HiddenItem {
  type: "review" | "comment" | "collection";
  id: string | number;
  username: string;
  content: string;
  ai_verdict?: string;
  created_at: string;
  tmdb_id?: number;
  media_type?: string;
  review_id?: string;
  is_public?: boolean;
  is_published?: boolean;
  item_count?: number;
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

interface AuditLogEntry {
  id: number;
  action: string;
  target_type: string;
  target_id: string;
  details: any;
  admin_username: string;
  created_at: string;
}

interface UserDetailData {
  user: {
    username: string;
    role: string;
    is_premium: boolean;
    created_at: string;
    updated_at?: string;
    avatar_url?: string;
    sanction_type?: string | null;
    sanction_reason?: string | null;
    sanction_until?: string | null;
    sanctioned_at?: string | null;
    sanctioned_by?: string | null;
    episode_watch_count: number;
  };
  reviews: { id: string; content: string; rating: number; created_at: string; tmdb_id: number; media_type: string; is_hidden: boolean }[];
  library: { tmdb_id: number; media_type: string; status: string; rating: number | null; season_number: number; updated_at: string }[];
  comments: { id: number; content: string; created_at: string; review_id: string; is_hidden: boolean }[];
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
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [section, setSection] = useState<"reports" | "users" | "sanctions" | "audit" | "content">("reports");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [sanctionType, setSanctionType] = useState("warned");
  const [sanctionReason, setSanctionReason] = useState("");
  const [sanctionDuration, setSanctionDuration] = useState(24);
  const [sanctioning, setSanctioning] = useState(false);
  const [sanctionMsg, setSanctionMsg] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditAction, setAuditAction] = useState("");
  const [contentFilter, setContentFilter] = useState<"all" | "review" | "comment" | "collection">("all");
  const [detailUser, setDetailUser] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<UserDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"reviews" | "library" | "comments">("reviews");

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      const username = user?.user_metadata?.username;
      if (username) {
        supabase.from("users").select("role").eq("username", username).maybeSingle()
          .then(
            ({ data: rows }) => setCurrentRole((rows as any)?.role || null),
            () => setCurrentRole(null)
          );
      } else {
        setCurrentRole(null);
      }
    });
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        const data = await res.json();
        let all: HiddenItem[] = [
          ...(data.reviews || []).map((r: any) => ({ ...r, type: "review" as const })),
          ...(data.comments || []).map((c: any) => ({ ...c, type: "comment" as const })),
        ];
        // Also fetch collections
        try {
          const colRes = await fetch("/api/admin/content?type=collection&limit=100");
          if (colRes.ok) {
            const colData = await colRes.json();
            if (colData.results) {
              all.push(...colData.results.map((c: any) => ({
                ...c, type: "collection" as const, id: c.id
              })));
            }
          }
        } catch {}
        all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  const fetchAuditLogs = async (offset = 0) => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", offset: String(offset) });
      if (auditAction) params.set("action", auditAction);
      const res = await fetch("/api/admin/audit-log?" + params.toString());
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.actions || []);
        setAuditTotal(data.total || 0);
      }
    } catch {}
    setAuditLoading(false);
  };

  const fetchUserDetail = async (username: string) => {
    setDetailUser(username);
    setDetailLoading(true);
    setDetailData(null);
    setDetailTab("reviews");
    try {
      const res = await fetch("/api/admin/user-detail?username=" + encodeURIComponent(username));
      if (res.ok) setDetailData(await res.json());
    } catch {}
    setDetailLoading(false);
  };

  useEffect(() => {
    if (currentRole && (section === "users" || section === "sanctions") && users.length === 0) {
      fetchUsers();
    }
    if (currentRole && section === "audit" && auditLogs.length === 0) {
      fetchAuditLogs();
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
    const key = `${item.type}-${item.id}`;
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
      {currentRole === null ? (
        <p className="text-text-secondary">Checking access...</p>
      ) : !currentRole ? (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-6 text-center">
          <p className="text-red-400 text-lg font-semibold mb-2">Access Denied</p>
          <p className="text-text-secondary text-sm">Admin or Moderator privileges required to view this page.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-6">
            <h1 className="text-2xl font-bold">🛡️ Admin</h1>
            <span className={"text-xs px-2 py-0.5 rounded-full " + (currentRole === "admin" ? "bg-red-900/30 text-red-300" : "bg-blue-900/30 text-blue-300")}>{currentRole}</span>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as "reports" | "users" | "sanctions" | "audit" | "content")}
              className="bg-bg-card text-text-primary text-sm rounded-xl px-3 py-2 border border-border focus:border-accent outline-none"
            >
              <option value="reports">🚨 Reports</option>
              <option value="users">👥 Users</option>
              {currentRole === "admin" && <option value="sanctions">⛔ Sanctions</option>}
              <option value="audit">📋 Audit Log</option>
              <option value="content">📦 All Content</option>
            </select>
          </div>

          {section === "reports" ? (
            <>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-text-secondary">Filter:</span>
                <select value={contentFilter} onChange={(e) => setContentFilter(e.target.value as any)}
                  className="bg-bg-card text-text-primary text-xs rounded-lg px-2 py-1 border border-border focus:border-accent outline-none">
                  <option value="all">All</option>
                  <option value="review">📝 Reviews</option>
                  <option value="comment">💬 Comments</option>
                  <option value="collection">📦 Collections</option>
                </select>
              </div>
              {loading ? (
                <p className="text-text-secondary">Loading...</p>
              ) : items.length === 0 ? (
                <p className="text-text-secondary">No hidden content. Clean! ✅</p>
              ) : (
                <div className="space-y-4">
                  {items.filter(item => contentFilter === "all" || item.type === contentFilter).map((item) => {
            const key = `${item.type}-${item.id}`;
            const verdict = verdicts[key] || item.ai_verdict;
            return (
              <div key={key} className="bg-bg-card rounded-xl p-4 border border-red-800/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded">
                      {item.type === "review" ? "📝 Review" : item.type === "comment" ? "💬 Comment" : "📦 Collection"}
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
                {item.type === "collection" ? (
                  <div className="flex gap-4 text-xs text-text-secondary mt-1 mb-2">
                    <span>📋 {item.content}</span>
                    <span>🔗 {item.item_count || 0} items</span>
                    <span>{item.is_public ? "🌐 Public" : "🔒 Private"}</span>
                    {item.is_published && <span>📢 Published</span>}
                  </div>
                ) : (
                  <p className="text-sm text-[#d1d5db] light:text-text-primary bg-bg-surface p-3 rounded-lg whitespace-pre-wrap">
                    {item.content}
                  </p>
                )}
                {verdict && item.type !== "collection" && (
                  <div className={"mt-2 text-xs p-2 rounded " + (
                    verdict.includes("DELETE")
                      ? "bg-red-900/30 text-red-300"
                      : verdict.includes("RESTORE")
                      ? "bg-green-900/30 text-green-300"
                      : "bg-yellow-900/30 text-yellow-300"
                  )}>
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
          ) : section === "audit" ? (
            /* Audit Log section */
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-text-secondary">{auditTotal} actions logged</p>
                <div className="flex items-center gap-2">
                  <select
                    value={auditAction}
                    onChange={(e) => { setAuditAction(e.target.value); setTimeout(() => fetchAuditLogs(), 100); }}
                    className="bg-bg-card text-text-primary text-xs rounded-lg px-2 py-1.5 border border-border focus:border-accent outline-none"
                  >
                    <option value="">All Actions</option>
                    <option value="sanction">Sanctions</option>
                    <option value="unsanction">Unsanctions</option>
                    <option value="hide_content">Hidden Content</option>
                    <option value="restore_content">Restored Content</option>
                    <option value="delete_content">Deleted Content</option>
                  </select>
                  <button
                    onClick={() => fetchAuditLogs()}
                    className="text-xs px-3 py-1.5 bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>
              {auditLoading ? (
                <p className="text-text-secondary">Loading...</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-text-secondary">No audit logs yet. Actions will appear here as admins perform them.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wide">
                        <th className="text-left py-2 px-3">When</th>
                        <th className="text-left py-2 px-3">Admin</th>
                        <th className="text-left py-2 px-3">Action</th>
                        <th className="text-left py-2 px-3">Target</th>
                        <th className="text-left py-2 px-3">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log, i) => (
                        <tr key={log.id} className={"border-b border-border/50 " + (i % 2 === 0 ? "bg-bg-card/30" : "")}>
                          <td className="py-2 px-3 text-text-secondary text-xs">{formatDate(log.created_at)}</td>
                          <td className="py-2 px-3 font-medium">{log.admin_username}</td>
                          <td className="py-2 px-3">
                            <span className={"text-xs px-2 py-0.5 rounded-full " + (
                              log.action === "sanction" ? "bg-red-900/30 text-red-300" :
                              log.action === "unsanction" ? "bg-green-900/30 text-green-300" :
                              log.action === "hide_content" ? "bg-yellow-900/30 text-yellow-300" :
                              log.action === "restore_content" ? "bg-green-900/30 text-green-300" :
                              "bg-red-900/30 text-red-300"
                            )}>
                              {log.action.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-xs text-text-secondary">{log.target_type}: </span>
                            {log.target_id}
                          </td>
                          <td className="py-2 px-3 text-text-secondary text-xs max-w-[200px] truncate">
                            {log.details ? (log.details.reason || log.details.sanction_type || log.details.content_preview || JSON.stringify(log.details).substring(0, 60)) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
                        <tr key={u.username} onClick={() => fetchUserDetail(u.username)} className={"border-b border-border/50 cursor-pointer hover:bg-accent/5 transition-colors " + (i % 2 === 0 ? "bg-bg-card/30" : "")}>
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

          {/* User Detail Panel */}
          {detailUser && (
            <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
              <div className="pointer-events-auto w-full max-w-lg h-screen bg-[#0a0a1a] border-l border-border overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-[#0a0a1a] border-b border-border px-5 py-4 flex items-center justify-between z-10">
                  <h2 className="text-lg font-bold text-text-primary">
                    👤 {detailUser}
                  </h2>
                  <button onClick={() => { setDetailUser(null); setDetailData(null); }} className="text-text-secondary hover:text-text-primary text-xl leading-none">&times;</button>
                </div>
                <div className="p-5">
                  {detailLoading ? (
                    <p className="text-text-secondary">Loading...</p>
                  ) : detailData ? (
                    <>
                      {/* User Info */}
                      <div className="bg-bg-card rounded-xl p-4 mb-4 border border-border">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div><span className="text-text-secondary text-xs">Role</span><p className="text-text-primary font-medium">{detailData.user.role}</p></div>
                          <div><span className="text-text-secondary text-xs">Premium</span><p className="text-text-primary">{detailData.user.is_premium ? "⭐ Yes" : "—"}</p></div>
                          <div><span className="text-text-secondary text-xs">Joined</span><p className="text-text-primary">{formatDate(detailData.user.created_at)}</p></div>
                          <div><span className="text-text-secondary text-xs">Episodes</span><p className="text-text-primary">{detailData.user.episode_watch_count}</p></div>
                        </div>
                        {/* Role management (admin only) */}
                        {currentRole === "admin" && detailData.user.role !== "admin" && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs text-text-secondary mb-2">Role: <span className="text-text-primary font-medium">{detailData.user.role}</span></p>
                            <div className="flex gap-2">
                              {detailData.user.role !== "moderator" && (
                                <button onClick={async () => {
                                  await fetch("/api/admin/users/role", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({username: detailUser, role: "moderator"}) });
                                  fetchUserDetail(detailUser!); fetchUsers();
                                }} className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 border border-blue-800/40 rounded hover:bg-blue-600/30">Promote to Moderator</button>
                              )}
                              {detailData.user.role === "moderator" && (
                                <button onClick={async () => {
                                  await fetch("/api/admin/users/role", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({username: detailUser, role: "user"}) });
                                  fetchUserDetail(detailUser!); fetchUsers();
                                }} className="text-xs px-2 py-1 bg-yellow-600/20 text-yellow-400 border border-yellow-800/40 rounded hover:bg-yellow-600/30">Demote to User</button>
                              )}
                            </div>
                          </div>
                        )}
                        {detailData.user.sanction_type && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs text-red-400 font-medium mb-1">⚠️ Active Sanction</p>
                            <p className="text-xs text-text-secondary">Type: <span className="text-red-300">{detailData.user.sanction_type}</span></p>
                            {detailData.user.sanction_reason && <p className="text-xs text-text-secondary">Reason: {detailData.user.sanction_reason}</p>}
                            {detailData.user.sanction_until && <p className="text-xs text-text-secondary">Until: {formatDate(detailData.user.sanction_until)}</p>}
                            {detailData.user.sanctioned_by && <p className="text-xs text-text-secondary">By: {detailData.user.sanctioned_by} ({detailData.user.sanctioned_at ? formatDate(detailData.user.sanctioned_at) : "?"})</p>}
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex gap-2 mb-4">
                        <div className="flex-1 bg-bg-card rounded-lg p-3 text-center border border-border">
                          <p className="text-lg font-bold text-text-primary">{detailData.reviews.length}</p>
                          <p className="text-xs text-text-secondary">Reviews</p>
                        </div>
                        <div className="flex-1 bg-bg-card rounded-lg p-3 text-center border border-border">
                          <p className="text-lg font-bold text-text-primary">{detailData.library.length}</p>
                          <p className="text-xs text-text-secondary">Tracked</p>
                        </div>
                        <div className="flex-1 bg-bg-card rounded-lg p-3 text-center border border-border">
                          <p className="text-lg font-bold text-text-primary">{detailData.comments.length}</p>
                          <p className="text-xs text-text-secondary">Comments</p>
                        </div>
                      </div>

                      {/* Tabs */}
                      <div className="flex gap-1 mb-3">
                        {(["reviews", "library", "comments"] as const).map((tab) => (
                          <button key={tab}
                            onClick={() => setDetailTab(tab)}
                            className={"flex-1 text-xs py-1.5 rounded-lg transition-colors " + (detailTab === tab ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary")}
                          >
                            {tab === "reviews" ? "📝 Reviews" : tab === "library" ? "📺 Tracked" : "💬 Comments"}
                          </button>
                        ))}
                      </div>

                      {/* Tab Content */}
                      {detailTab === "reviews" && (
                        detailData.reviews.length === 0 ? (
                          <p className="text-text-secondary text-sm">No reviews</p>
                        ) : (
                          <div className="space-y-2">
                            {detailData.reviews.map((r) => (
                              <div key={r.id} className={"bg-bg-card rounded-lg p-3 border text-sm " + (r.is_hidden ? "border-red-800/30" : "border-border")}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-text-secondary">{r.media_type} #{r.tmdb_id}</span>
                                  <span className="text-xs text-text-secondary">{formatDate(r.created_at)}</span>
                                </div>
                                <p className="text-text-primary text-xs line-clamp-3">{r.content}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gold">{"★".repeat(Math.round(r.rating || 0))}</span>
                                  {r.is_hidden && <span className="text-xs bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded">hidden</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {detailTab === "library" && (
                        detailData.library.length === 0 ? (
                          <p className="text-text-secondary text-sm">No tracked titles</p>
                        ) : (
                          <div className="space-y-1">
                            {detailData.library.map((t, i) => (
                              <div key={i} className="flex items-center justify-between bg-bg-card rounded-lg p-2.5 border border-border text-sm">
                                <div>
                                  <span className="text-text-primary text-xs">{t.media_type} #{t.tmdb_id}</span>
                                  {t.season_number > 0 && <span className="text-text-secondary text-xs ml-1">S{t.season_number}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={"text-xs px-2 py-0.5 rounded-full " + (t.status === "completed" ? "bg-green-900/30 text-green-300" : t.status === "watching" ? "bg-blue-900/30 text-blue-300" : "bg-bg-surface text-text-secondary")}>{t.status.replace(/_/g, " ")}</span>
                                  {t.rating && <span className="text-xs text-gold">★{t.rating}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {detailTab === "comments" && (
                        detailData.comments.length === 0 ? (
                          <p className="text-text-secondary text-sm">No comments</p>
                        ) : (
                          <div className="space-y-2">
                            {detailData.comments.map((c) => (
                              <div key={c.id} className={"bg-bg-card rounded-lg p-3 border text-sm " + (c.is_hidden ? "border-red-800/30" : "border-border")}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-text-secondary">Review #{c.review_id}</span>
                                  <span className="text-xs text-text-secondary">{formatDate(c.created_at)}</span>
                                </div>
                                <p className="text-text-primary text-xs line-clamp-3">{c.content}</p>
                                {c.is_hidden && <span className="text-xs bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded mt-1 inline-block">hidden</span>}
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </>
                  ) : (
                    <p className="text-text-secondary text-sm">Failed to load user data</p>
                  )}
                </div>
              </div>
              {/* Backdrop */}
              <div className="pointer-events-auto fixed inset-0 bg-black/40" onClick={() => { setDetailUser(null); setDetailData(null); }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
