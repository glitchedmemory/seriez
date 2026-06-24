"use client";

import { useState, useEffect } from "react";

type Section = "dashboard" | "reports" | "users" | "content" | "search" | "popular" | "activity" | "announce" | "sanctions" | "audit";

export default function AdminPanel({ userRole }: { userRole: string | null }) {
  const [section, setSection] = useState<Section>("dashboard");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [contentResults, setContentResults] = useState<any[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentQ, setContentQ] = useState("");
  const [contentFilter, setContentFilter] = useState("all");
  const [contentType, setContentType] = useState("all");
  const [userDetail, setUserDetail] = useState<any>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [sanctionTarget, setSanctionTarget] = useState("");
  const [sanctionType, setSanctionType] = useState("warn");
  const [sanctionReason, setSanctionReason] = useState("");
  const [sanctionSubmitting, setSanctionSubmitting] = useState(false);
  const [sanctionMsg, setSanctionMsg] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [roleMsg, setRoleMsg] = useState("");
  const isAdmin = userRole === "admin";
  const [searchTop, setSearchTop] = useState<any[]>([]);
  const [searchDaily, setSearchDaily] = useState<any[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [popularTracked, setPopularTracked] = useState<any[]>([]);
  const [popularReviewed, setPopularReviewed] = useState<any[]>([]);
  const [popularCollected, setPopularCollected] = useState<any[]>([]);
  const [popularLoading, setPopularLoading] = useState(false);
  const [dau, setDau] = useState<any[]>([]);
  const [mostActive, setMostActive] = useState<any[]>([]);
  const [signupTrend, setSignupTrend] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState("");
  const [announceSending, setAnnounceSending] = useState(false);
  const [announceResult, setAnnounceResult] = useState<string | null>(null);
        const all = [
          ...(data.reviews || []).map((r: any) => ({ ...r, type: "review" })),
          ...(data.comments || []).map((c: any) => ({ ...c, type: "comment" })),
          ...(data.collections || []).map((l: any) => ({ ...l, type: "collection" })),
        ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setItems(all);
      }
    } catch {}
    setLoading(false);
  };

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

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    } catch {}
    setStatsLoading(false);
  };

  const fetchContent = async () => {
    setContentLoading(true);
    try {
      const params = new URLSearchParams();
      if (contentQ) params.set("q", contentQ);
      if (contentFilter !== "all") params.set("hidden", contentFilter);
      if (contentType !== "all") params.set("type", contentType);
      const res = await fetch(`/api/admin/content?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setContentResults(data.results || []);
      }
    } catch {}
    setContentLoading(false);
  };

  const fetchUserDetail = async (target: string) => {
    setUserDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/user-detail?username=${encodeURIComponent(target)}`);
      if (res.ok) setUserDetail(await res.json());
    } catch {}
    setUserDetailLoading(false);
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch("/api/admin/audit-log");
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch {}
    setAuditLoading(false);
  };

  const fetchSearchAnalytics = async () => {
    setSearchLoading(true);
    try {
      const res = await fetch("/api/admin/search-analytics");
      if (res.ok) {
        const data = await res.json();
        setSearchTop(data.top_queries || []);
        setSearchDaily(data.daily_volume || []);
        setSearchTotal(data.total_searches || 0);
      }
    } catch {}
    setSearchLoading(false);
  };

  const fetchPopularContent = async () => {
    setPopularLoading(true);
    try {
      const res = await fetch("/api/admin/popular-content");
      if (res.ok) {
        const data = await res.json();
        setPopularTracked(data.most_tracked || []);
        setPopularReviewed(data.most_reviewed || []);
        setPopularCollected(data.most_collected || []);
      }
    } catch {}
    setPopularLoading(false);
  };

  const fetchUserActivity = async () => {
    setActivityLoading(true);
    try {
      const res = await fetch("/api/admin/user-activity");
      if (res.ok) {
        const data = await res.json();
        setDau(data.dau || []);
        setMostActive(data.most_active || []);
        setSignupTrend(data.signup_trend || []);
      }
    } catch {}
    setActivityLoading(false);
  };

  const sendAnnounce = async () => {
    if (!announceMessage.trim() || announceSending) return;
    setAnnounceSending(true);
    setAnnounceResult(null);
    try {
      const res = await fetch("/api/admin/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: announceMessage.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setAnnounceResult(`Sent to ${data.sent_to} users`);
        setAnnounceMessage("");
      } else {
        setAnnounceResult(data.error || "Failed");
      }
    } catch {
      setAnnounceResult("Network error");
    }
    setAnnounceSending(false);
    setTimeout(() => setAnnounceResult(null), 5000);
  };

  const submitSanction = async () => {
    if (!sanctionTarget.trim()) return;
    setSanctionSubmitting(true);
    setSanctionMsg("");
    try {
      const res = await fetch("/api/admin/sanction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sanctionTarget.trim(), type: sanctionType, reason: sanctionReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setSanctionMsg(`✅ ${sanctionTarget} sanctioned: ${sanctionType}`);
        setSanctionTarget("");
        setSanctionReason("");
      } else {
        setSanctionMsg(`❌ ${data.error || "Failed"}`);
      }
    } catch {
      setSanctionMsg("❌ Network error");
    }
    setSanctionSubmitting(false);
  };

  const handleRoleChange = async (target: string, newRole: string) => {
    setRoleMsg("");
    try {
      const res = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: target, role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setRoleMsg(`✅ ${target} → ${newRole}`);
        fetchUserDetail(target);
        fetchUsers();
      } else {
        setRoleMsg(`❌ ${data.error || "Failed"}`);
      }
    } catch {
      setRoleMsg("❌ Network error");
    }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => {
    if (section === "reports" && items.length === 0) fetchItems();
    if (section === "users" && users.length === 0) fetchUsers();
    if (section === "audit" && auditLogs.length === 0) fetchAuditLogs();
    if (section === "search" && searchTop.length === 0 && !searchLoading) fetchSearchAnalytics();
    if (section === "popular" && popularTracked.length === 0 && !popularLoading) fetchPopularContent();
    if (section === "activity" && dau.length === 0 && !activityLoading) fetchUserActivity();
  }, [section]);

  const handleAction = async (item: any, action: "restore" | "delete") => {
    await fetch(`/api/admin/reports?action=${action}&target_type=${item.type}&target_id=${item.id}`);
    setItems(prev => prev.filter(i => i.id !== item.id || i.type !== item.type));
  };

  const handleContentAction = async (item: any, action: "hide" | "show" | "delete") => {
    if (action === "delete") {
      await fetch(`/api/admin/reports?action=delete&target_type=${item.content_type}&target_id=${item.id}`);
    } else {
      await fetch(`/api/admin/content-action?action=${action}&type=${item.content_type}&id=${item.id}`);
    }
    fetchContent();
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  return (
    <div className="px-4 mt-6 pb-24">
      {/* Section selector */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold text-text-primary">🛡️ Admin</h2>
        {userRole && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${userRole === "admin" ? "bg-red-900/30 text-red-300" : "bg-blue-900/30 text-blue-300"}`}>
            {userRole}
          </span>
        )}
        <select
          value={section}
          onChange={(e) => setSection(e.target.value as Section)}
          className="bg-bg-card text-text-primary text-xs rounded-lg px-2.5 py-1.5 border border-border focus:border-accent outline-none"
        >
          <option value="dashboard">📊 Dashboard</option>
          <option value="reports">🚨 Reports</option>
          <option value="users">👥 Users</option>
          <option value="content">🔍 Content</option>
          <option value="search">🔎 Search</option>
          <option value="popular">⭐ Popular</option>
          <option value="activity">📈 Activity</option>
          <option value="announce">📢 Announce</option>
          {isAdmin && <option value="sanctions">⛔ Sanctions</option>}
          <option value="audit">📋 Audit Log</option>
        </select>
        {userDetail && (
          <button onClick={() => setUserDetail(null)} className="text-xs text-accent hover:underline ml-auto">
            ← Back to list
          </button>
        )}
      </div>

      {section === "dashboard" && (
        <>
          {statsLoading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-text-primary">{stats.totalUsers}</p>
                <p className="text-[10px] text-text-secondary uppercase mt-1">Total Users</p>
              </div>
              <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{stats.todaySignups}</p>
                <p className="text-[10px] text-text-secondary uppercase mt-1">Today</p>
              </div>
              <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-400">{stats.weekSignups}</p>
                <p className="text-[10px] text-text-secondary uppercase mt-1">This Week</p>
              </div>
              <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gold">{stats.premiumUsers}</p>
                <p className="text-[10px] text-text-secondary uppercase mt-1">Premium</p>
              </div>
              <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-text-primary">{stats.totalReviews}</p>
                <p className="text-[10px] text-text-secondary uppercase mt-1">Reviews</p>
              </div>
              <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-text-primary">{stats.totalTracked}</p>
                <p className="text-[10px] text-text-secondary uppercase mt-1">Tracked</p>
              </div>
            </div>
          ) : null}
          <button onClick={fetchStats} className="mt-4 text-xs px-3 py-1.5 bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            🔄 Refresh
          </button>
        </>
      )}

      {section === "reports" && (
        <>
          {loading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-text-secondary text-sm">No hidden content. Clean! ✅</p>
          ) : (
            <div className="space-y-3">
              {items.map((item: any) => (
                <div key={`${item.type}-${item.id}`} className="bg-bg-card rounded-xl p-4 border border-red-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.type === "review" ? "bg-red-900/50 text-red-300" :
                        item.type === "collection" ? "bg-green-900/50 text-green-300" :
                        "bg-purple-900/50 text-purple-300"
                      }`}>
                        {item.type === "review" ? "📝 Review" : item.type === "collection" ? "📦 Collection" : "💬 Comment"}
                      </span>
                      <span className="text-xs text-text-secondary">{item.username}</span>
                      {item.report_count > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          item.risk_level === "high" ? "bg-red-900/60 text-red-300" : "bg-yellow-900/50 text-yellow-300"
                        }`}>
                          🚩 {item.report_count}
                        </span>
                      )}
                      {item.risk_level === "high" && (
                        <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">HIGH RISK</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(item, "restore")}
                        className="text-xs px-2 py-1 bg-green-600/30 text-green-300 rounded hover:bg-green-600/50">✅ Restore</button>
                      <button onClick={() => handleAction(item, "delete")}
                        className="text-xs px-2 py-1 bg-red-600/30 text-red-300 rounded hover:bg-red-600/50">🗑️ Delete</button>
                    </div>
                  </div>
                  <p className="text-sm text-[#d1d5db] bg-bg-surface p-3 rounded-lg whitespace-pre-wrap">{item.content}</p>
                  {/* Report details */}
                  {item.reporters && item.reporters.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-red-800/20">
                      <p className="text-[10px] text-text-secondary mb-1">Reported by:</p>
                      {item.reporters.slice(0, 5).map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-text-secondary ml-2">
                          <span className="text-accent">{r.username}</span>
                          <span className={`px-1 py-0.5 rounded text-[9px] ${
                            ["spam","obscenity","hate_speech"].includes(r.reason) ? "bg-red-900/30 text-red-300" : "bg-bg-surface text-text-secondary"
                          }`}>{r.reason}</span>
                          <span className="text-text-secondary/50">{new Date(r.at).toLocaleDateString()}</span>
                        </div>
                      ))}
                      {item.reporters.length > 5 && (
                        <p className="text-[10px] text-text-secondary ml-2 mt-1">+{item.reporters.length - 5} more</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {section === "users" && !userDetail && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-text-secondary">{users.length} users</p>
            <button onClick={fetchUsers} className="text-xs px-2.5 py-1 bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">
              🔄 Refresh
            </button>
          </div>
          {usersLoading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-text-secondary text-sm">No users found.</p>
          ) : (
            <div className="space-y-1">
              {users.map((u: any, i: number) => (
                <button
                  key={u.username}
                  onClick={() => fetchUserDetail(u.username)}
                  className={`w-full text-left flex items-center justify-between py-2 px-3 rounded-lg hover:bg-bg-card transition-colors ${i % 2 === 0 ? "bg-bg-card/30" : ""}`}
                >
                  <div>
                    <span className="text-sm font-medium text-text-primary">{u.username}</span>
                    <span className="text-xs text-text-secondary ml-2">{formatDate(u.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.role === "admin" && <span className="text-[10px] bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded-full">admin</span>}
                    {u.role === "moderator" && <span className="text-[10px] bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded-full">mod</span>}
                    {u.sanction_type && <span className="text-[10px] bg-yellow-900/30 text-yellow-300 px-1.5 py-0.5 rounded-full">⚠️</span>}
                    {u.is_premium && <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full">⭐</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {section === "users" && userDetail && (
        <>
          {userDetailLoading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : (
            <div className="space-y-4">
              {/* User info */}
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-text-primary">{userDetail.user.username.slice(0,1).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-text-primary">{userDetail.user.username}</p>
                    <p className="text-xs text-text-secondary">Joined {formatDate(userDetail.user.created_at)}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    {userDetail.user.role === "admin" && <span className="text-xs bg-red-900/30 text-red-300 px-2 py-0.5 rounded-full">admin</span>}
                    {userDetail.user.role === "moderator" && <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-full">moderator</span>}
                    {userDetail.user.sanction_type && (
                      <span className="text-xs bg-yellow-900/30 text-yellow-300 px-2 py-0.5 rounded-full">
                        {userDetail.user.sanction_type}{userDetail.user.sanction_until ? ` until ${new Date(userDetail.user.sanction_until).toLocaleDateString()}` : ""}
                      </span>
                    )}
                    {userDetail.user.is_premium && <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full">⭐ Premium</span>}
                  </div>
                </div>
                {/* Role management (admin only, not self) */}
                {isAdmin && userDetail.user.role !== "admin" && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-text-secondary">Role:</span>
                    {userDetail.user.role === "moderator" ? (
                      <button onClick={() => handleRoleChange(userDetail.user.username, "user")}
                        className="text-xs px-2 py-1 bg-orange-600/20 text-orange-300 rounded hover:bg-orange-600/40">
                        Demote to User
                      </button>
                    ) : (
                      <button onClick={() => handleRoleChange(userDetail.user.username, "moderator")}
                        className="text-xs px-2 py-1 bg-blue-600/20 text-blue-300 rounded hover:bg-blue-600/40">
                        Promote to Moderator
                      </button>
                    )}
                    {roleMsg && <span className="text-xs text-green-400">{roleMsg}</span>}
                  </div>
                )}
              </div>
              {/* Reviews */}
              <div>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Reviews ({userDetail.reviews.length})</h3>
                {userDetail.reviews.length === 0 ? (
                  <p className="text-xs text-text-secondary">No reviews</p>
                ) : (
                  <div className="space-y-2">
                    {userDetail.reviews.slice(0, 10).map((r: any) => (
                      <div key={r.id} className={`bg-bg-card border rounded-lg p-3 text-xs ${r.is_hidden ? "border-red-800/30" : "border-border"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-yellow-400">{"★".repeat(r.rating)}</span>
                          {r.is_hidden && <span className="text-[10px] bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded">hidden</span>}
                          <span className="text-text-secondary ml-auto">{formatDate(r.created_at)}</span>
                        </div>
                        {r.content && <p className="text-text-secondary leading-relaxed line-clamp-3">{r.content}</p>}
                      </div>
                    ))}
                    {userDetail.reviews.length > 10 && <p className="text-xs text-text-secondary">+{userDetail.reviews.length - 10} more</p>}
                  </div>
                )}
              </div>
              {/* Library */}
              <div>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Library ({userDetail.library.length})</h3>
                {userDetail.library.length === 0 ? (
                  <p className="text-xs text-text-secondary">No items</p>
                ) : (
                  <div className="space-y-1">
                    {userDetail.library.slice(0, 10).map((l: any) => (
                      <div key={`${l.mediaType}-${l.tmdbId}`} className="flex items-center gap-2 text-xs py-1">
                        <span className={l.status === "completed" ? "text-green-400" : l.status === "watching" ? "text-blue-400" : "text-amber-400"}>
                          {l.status === "completed" ? "✓" : l.status === "watching" ? "▶" : "📌"}
                        </span>
                        <span className="text-text-primary truncate flex-1">{l.title}</span>
                        {l.rating && <span className="text-pink-400">★{l.rating}</span>}
                      </div>
                    ))}
                    {userDetail.library.length > 10 && <p className="text-xs text-text-secondary">+{userDetail.library.length - 10} more</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {section === "content" && (
        <>
          <div className="flex gap-2 mb-3">
            <input
              value={contentQ}
              onChange={(e) => setContentQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchContent()}
              placeholder="Search content..."
              className="flex-1 bg-bg-card text-text-primary text-xs rounded-lg px-3 py-1.5 border border-border focus:border-accent outline-none placeholder:text-text-secondary"
            />
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="bg-bg-card text-text-primary text-xs rounded-lg px-2 py-1.5 border border-border focus:border-accent outline-none"
            >
              <option value="all">All Types</option>
              <option value="review">Reviews</option>
              <option value="comment">Comments</option>
              <option value="collection">Collections</option>
            </select>
            <select
              value={contentFilter}
              onChange={(e) => setContentFilter(e.target.value)}
              className="bg-bg-card text-text-primary text-xs rounded-lg px-2 py-1.5 border border-border focus:border-accent outline-none"
            >
              <option value="all">All</option>
              <option value="no">Visible</option>
              <option value="yes">Hidden</option>
            </select>
            <button onClick={fetchContent} className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg hover:bg-[#5558e7] transition-colors">
              Search
            </button>
          </div>
          {contentLoading ? (
            <p className="text-text-secondary text-sm">Searching...</p>
          ) : contentResults.length === 0 ? (
            <p className="text-text-secondary text-sm">No results. Try a search term.</p>
          ) : (
            <div className="space-y-2">
              {contentResults.map((item: any) => (
                <div key={`${item.content_type}-${item.id}`} className={`bg-bg-card border rounded-lg p-3 text-xs ${item.is_hidden ? "border-red-800/30" : "border-border"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      item.content_type === "review" ? "bg-blue-900/30 text-blue-300" :
                      item.content_type === "collection" ? "bg-green-900/30 text-green-300" :
                      "bg-purple-900/30 text-purple-300"
                    }`}>
                      {item.content_type === "review" ? "Review" : item.content_type === "collection" ? "Collection" : "Comment"}
                    </span>
                    <span className="text-text-secondary">{item.username}</span>
                    {item.is_hidden && <span className="text-[10px] bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded">hidden</span>}
                    {item.content_type === "collection" && item.item_count !== undefined && (
                      <span className="text-[10px] text-text-secondary">{item.item_count} items</span>
                    )}
                    <span className="text-text-secondary ml-auto">{formatDate(item.created_at)}</span>
                  </div>
                  <p className="text-text-secondary leading-relaxed line-clamp-2 mb-2">{item.content}</p>
                  <div className="flex gap-2">
                    {item.is_hidden ? (
                      <button onClick={() => handleContentAction(item, "show")} className="text-[10px] px-2 py-0.5 bg-green-600/20 text-green-300 rounded hover:bg-green-600/40">Show</button>
                    ) : (
                      <button onClick={() => handleContentAction(item, "hide")} className="text-[10px] px-2 py-0.5 bg-yellow-600/20 text-yellow-300 rounded hover:bg-yellow-600/40">Hide</button>
                    )}
                    <button onClick={() => handleContentAction(item, "delete")} className="text-[10px] px-2 py-0.5 bg-red-600/20 text-red-300 rounded hover:bg-red-600/40">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {section === "search" && (
        <>
          {searchLoading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : (
            <div className="space-y-4">
              {/* Total */}
              <div className="bg-bg-card rounded-xl p-4">
                <p className="text-xs text-text-secondary">Total searches (30 days)</p>
                <p className="text-2xl font-bold text-text-primary mt-1">{searchTotal.toLocaleString()}</p>
              </div>

              {/* Daily chart — simple bar chart */}
              <div className="bg-bg-card rounded-xl p-4">
                <p className="text-xs text-text-secondary mb-3">Daily Search Volume</p>
                <div className="flex items-end gap-0.5 h-24">
                  {searchDaily.length === 0 && <p className="text-xs text-text-secondary">No data</p>}
                  {searchDaily.map((d: any) => {
                    const max = Math.max(...searchDaily.map((x: any) => x.count), 1);
                    const pct = (d.count / max) * 100;
                    const label = d.date.slice(5);
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: ${d.count}`}>
                        <div className="w-full bg-accent/60 rounded-t" style={{ height: `${Math.max(pct, 2)}%` }} />
                        <span className="text-[8px] text-text-secondary mt-0.5 rotate-90 origin-left" style={{ transform: "rotate(-45deg)" }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top queries */}
              <div className="bg-bg-card rounded-xl p-4">
                <p className="text-xs text-text-secondary mb-2">Top Search Queries</p>
                {searchTop.length === 0 ? (
                  <p className="text-sm text-text-secondary">No searches recorded yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {searchTop.slice(0, 30).map((q: any, i: number) => (
                      <div key={q.query} className="flex items-center justify-between text-sm">
                        <span className="text-text-primary truncate flex-1">
                          <span className="text-text-secondary text-xs mr-2">#{i + 1}</span>
                          {q.query}
                        </span>
                        <span className="text-text-secondary text-xs ml-2 shrink-0">{q.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <button onClick={fetchSearchAnalytics} className="text-xs mt-3 px-2.5 py-1 bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">Refresh</button>
        </>
      )}

      {section === "popular" && (
        <>
          {popularLoading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : (
            <div className="space-y-4">
              {/* Most Tracked */}
              <div className="bg-bg-card rounded-xl p-4">
                <p className="text-xs text-text-secondary mb-2">Most Tracked</p>
                {popularTracked.length === 0 ? (
                  <p className="text-sm text-text-secondary">No tracking data yet</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {popularTracked.slice(0, 20).map((t: any, i: number) => (
                      <div key={`t-${t.tmdb_id}`} className="flex items-center gap-3">
                        <span className="text-text-secondary text-xs w-5">{i + 1}</span>
                        {t.poster && <img src={t.poster} alt="" className="w-8 h-12 rounded object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{t.title}</p>
                          <p className="text-[10px] text-text-secondary">{t.count} tracking entries</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Most Reviewed */}
              <div className="bg-bg-card rounded-xl p-4">
                <p className="text-xs text-text-secondary mb-2">Most Reviewed</p>
                {popularReviewed.length === 0 ? (
                  <p className="text-sm text-text-secondary">No review data yet</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {popularReviewed.slice(0, 20).map((r: any, i: number) => (
                      <div key={`r-${r.tmdb_id}`} className="flex items-center gap-3">
                        <span className="text-text-secondary text-xs w-5">{i + 1}</span>
                        {r.poster && <img src={r.poster} alt="" className="w-8 h-12 rounded object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{r.title}</p>
                          <p className="text-[10px] text-text-secondary">{r.count} reviews · Avg ★ {r.avg_rating}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Most Collected */}
              <div className="bg-bg-card rounded-xl p-4">
                <p className="text-xs text-text-secondary mb-2">Most Collected</p>
                {popularCollected.length === 0 ? (
                  <p className="text-sm text-text-secondary">No collection data yet</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {popularCollected.slice(0, 20).map((c: any, i: number) => (
                      <div key={`c-${c.tmdb_id}`} className="flex items-center gap-3">
                        <span className="text-text-secondary text-xs w-5">{i + 1}</span>
                        {c.poster && <img src={c.poster} alt="" className="w-8 h-12 rounded object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{c.title}</p>
                          <p className="text-[10px] text-text-secondary">{c.count} collections</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <button onClick={fetchPopularContent} className="text-xs mt-3 px-2.5 py-1 bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">Refresh</button>
        </>
      )}

      {section === "activity" && (
        <>
          {activityLoading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : (
            <div className="space-y-4">
              {/* DAU chart */}
              <div className="bg-bg-card rounded-xl p-4">
                <p className="text-xs text-text-secondary mb-3">Daily Active Users</p>
                {dau.length === 0 ? (
                  <p className="text-sm text-text-secondary">No activity data yet</p>
                ) : (
                  <div className="flex items-end gap-0.5 h-20">
                    {dau.map((d: any) => {
                      const max = Math.max(...dau.map((x: any) => x.count), 1);
                      const pct = (d.count / max) * 100;
                      const label = d.date.slice(5);
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: ${d.count}`}>
                          <div className="w-full bg-green-500/60 rounded-t" style={{ height: `${Math.max(pct, 2)}%` }} />
                          <span className="text-[7px] text-text-secondary mt-0.5" style={{ transform: "rotate(-45deg)", transformOrigin: "left" }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Signup trend */}
              <div className="bg-bg-card rounded-xl p-4">
                <p className="text-xs text-text-secondary mb-3">New Signups</p>
                {signupTrend.length === 0 ? (
                  <p className="text-sm text-text-secondary">No signup data yet</p>
                ) : (
                  <div className="flex items-end gap-0.5 h-20">
                    {signupTrend.map((d: any) => {
                      const max = Math.max(...signupTrend.map((x: any) => x.count), 1);
                      const pct = (d.count / max) * 100;
                      const label = d.date.slice(5);
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: ${d.count}`}>
                          <div className="w-full bg-blue-500/60 rounded-t" style={{ height: `${Math.max(pct, 2)}%` }} />
                          <span className="text-[7px] text-text-secondary mt-0.5" style={{ transform: "rotate(-45deg)", transformOrigin: "left" }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Most active users */}
              <div className="bg-bg-card rounded-xl p-4">
                <p className="text-xs text-text-secondary mb-2">Most Active Users (7 days)</p>
                {mostActive.length === 0 ? (
                  <p className="text-sm text-text-secondary">No recent activity</p>
                ) : (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {mostActive.map((u: any, i: number) => (
                      <div key={u.username} className="flex items-center justify-between text-sm">
                        <span className="text-text-primary">
                          <span className="text-text-secondary text-xs mr-2">#{i + 1}</span>
                          {u.username}
                        </span>
                        <span className="text-text-secondary text-xs">{u.count} actions</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <button onClick={fetchUserActivity} className="text-xs mt-3 px-2.5 py-1 bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">Refresh</button>
        </>
      )}

      {section === "announce" && (
        <div className="bg-bg-card rounded-xl p-4 space-y-3">
          <p className="text-xs text-text-secondary">Send a notification to all users. Appears in each user's notification list.</p>
          <textarea
            value={announceMessage}
            onChange={(e) => setAnnounceMessage(e.target.value)}
            placeholder="Write announcement message..."
            rows={4}
            maxLength={500}
            className="w-full bg-bg-surface text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-accent outline-none resize-none placeholder:text-text-secondary"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={sendAnnounce}
              disabled={announceSending || !announceMessage.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40 hover:bg-[#5558e7] transition-colors"
            >
              {announceSending ? "Sending..." : "Send to All Users"}
            </button>
            {announceResult && (
              <span className={`text-xs ${announceResult.startsWith("Sent") ? "text-green-400" : "text-red-400"}`}>
                {announceResult}
              </span>
            )}
          </div>
          <p className="text-[10px] text-text-secondary">{announceMessage.length}/500</p>
        </div>
      )}

      {section === "sanctions" && isAdmin && (
        <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Issue Sanction</h3>
          <div className="flex gap-2">
            <input
              value={sanctionTarget}
              onChange={(e) => setSanctionTarget(e.target.value)}
              placeholder="Username"
              className="flex-1 bg-bg-surface text-text-primary text-xs rounded-lg px-3 py-1.5 border border-border focus:border-accent outline-none placeholder:text-text-secondary"
            />
            <select
              value={sanctionType}
              onChange={(e) => setSanctionType(e.target.value)}
              className="bg-bg-surface text-text-primary text-xs rounded-lg px-2 py-1.5 border border-border focus:border-accent outline-none"
            >
              <option value="warn">⚠️ Warn</option>
              <option value="comment_restrict">💬 Comment Restrict</option>
              <option value="suspend">🚫 Suspend 24h</option>
              <option value="ban">🔨 Ban</option>
            </select>
          </div>
          <input
            value={sanctionReason}
            onChange={(e) => setSanctionReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full bg-bg-surface text-text-primary text-xs rounded-lg px-3 py-1.5 border border-border focus:border-accent outline-none placeholder:text-text-secondary"
          />
          <button
            onClick={submitSanction}
            disabled={sanctionSubmitting || !sanctionTarget.trim()}
            className="text-xs px-4 py-1.5 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/40 disabled:opacity-50 transition-colors"
          >
            {sanctionSubmitting ? "Submitting..." : "Apply Sanction"}
          </button>
          {sanctionMsg && <p className={`text-xs ${sanctionMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{sanctionMsg}</p>}
        </div>
      )}

      {section === "audit" && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-text-secondary">{auditLogs.length} entries</p>
            <button onClick={fetchAuditLogs} className="text-xs px-2.5 py-1 bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">
              🔄 Refresh
            </button>
          </div>
          {auditLoading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-text-secondary text-sm">No audit log entries yet.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((entry: any) => (
                <div key={entry.id} className="bg-bg-card border border-border rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-accent font-medium">{entry.admin_username}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      entry.action.includes("delete") ? "bg-red-900/30 text-red-300" :
                      entry.action.includes("hide") || entry.action.includes("sanction") ? "bg-yellow-900/30 text-yellow-300" :
                      "bg-green-900/30 text-green-300"
                    }`}>
                      {entry.action}
                    </span>
                    <span className="text-text-secondary">{entry.target_type}:{entry.target_id}</span>
                    <span className="text-text-secondary ml-auto">{formatDate(entry.created_at)}</span>
                  </div>
                  {entry.details && typeof entry.details === "object" && (
                    <p className="text-text-secondary text-[10px] mt-1">
                      {Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatBadge({ value, label, color, prefix = "" }: { value: string | number; label: string; color: string; prefix?: string }) {
  return (
    <div className="flex-1 text-center">
      <p className={`text-lg font-bold ${color}`}>{prefix}{value}</p>
      <p className="text-[10px] text-text-secondary uppercase tracking-wide">{label}</p>
    </div>
  );
}
