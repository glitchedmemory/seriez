"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileSkeleton } from "@/components/Skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";
import HistoryClient from "@/app/history/HistoryClient";
import YearlyRecapSlideshow from "@/components/YearlyRecapSlideshow";
import { StreamingTop10 } from "@/components/StreamingTop10";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

interface CompareData {
  matchRate: number;
  bothEnjoyed: { tmdbId: number; mediaType: string; title: string; poster: string | null; year: string | null }[];
  divergent: { tmdbId: number; mediaType: string; title: string; poster: string | null; year: string | null; myRating: number; theirRating: number }[];
}

interface LibraryItem {
  id: string;
  tmdb_id: number;
  media_type: string;
  status: string;
  title: string;
  poster: string | null;
  year: number | null;
  rating: number | null;
  updated_at: string;
}

interface ProfileStats {
  totals: { watched: number; watching: number; planned: number; rated: number; reviewed: number; hours: number };
  completion: { rate: number; started: number; completed: number };
  rating: { average: number; distribution: { score: number; count: number }[] };
  mediaBreakdown: { movie: number; tv: number; anime: number };
  mediaHours: { movie: number; tv: number; anime: number };
  genres: { name: string; count: number }[];
  topActors: { name: string; count: number; personId?: number; personSource?: string; image?: string | null }[];
  topDirectors: { name: string; count: number; personId?: number; personSource?: string; image?: string | null }[];
  monthlyWatch: { month: string; count: number }[];
  yearlyRecap: { hours: number; titles: number; topRated: { tmdb_id: number; media_type: string; rating: number }[] };
  viewerDNA: { style: string; styleDescription: string; styleReady: boolean; styleStatus: string | null; taste: string; tasteDescription: string; tasteReady: boolean; tasteStatus: string | null };
}

export default function ProfilePage() {
  const [user, setUser] = useState<{ email?: string; user_metadata?: { username?: string }; created_at?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [followList, setFollowList] = useState<any[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [bgScale, setBgScale] = useState(100);
  const [bgPositionX, setBgPositionX] = useState(50);
  const [bgPositionY, setBgPositionY] = useState(50);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<"movie" | "tv" | "anime">("movie");
  const [isPremium, setIsPremium] = useState(false);
  const [reviewsMap, setReviewsMap] = useState<Record<string, string>>({});
  const [activeView, setActiveView] = useState<"profile" | "insights" | "ott" | "reviews" | "admin">("profile");
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [isFavoriteMode, setIsFavoriteMode] = useState(false);
  const [favoriteDirectors, setFavoriteDirectors] = useState<any[]>([]);
  const [favoriteActors, setFavoriteActors] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [joinedDate, setJoinedDate] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const profileUsername = searchParams.get("username");
  const tab = searchParams.get("tab");
  const ownUsername = user?.user_metadata?.username;
  const localStorageUsername = typeof window !== "undefined" ? localStorage.getItem("seriez-username") : null;
  const effectiveUsername = profileUsername || ownUsername || (user ? localStorageUsername : null);
  const isOwn = !profileUsername || (profileUsername === ownUsername) || (profileUsername === localStorageUsername);

  const fetchFollowData = useCallback(async () => {
    if (!effectiveUsername) return;
    try {
      const [followersRes, followingRes] = await Promise.all([
        fetch(`/api/follow?username=${encodeURIComponent(effectiveUsername)}&type=followers`).then(r => r.json()),
        fetch(`/api/follow?username=${encodeURIComponent(effectiveUsername)}&type=following`).then(r => r.json()),
      ]);
      setFollowersCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);
    } catch {}
  }, [effectiveUsername]);

  const fetchFollowStatus = useCallback(async () => {
    if (!ownUsername || !profileUsername || isOwn) return;
    try {
      const res = await fetch(`/api/follow?target=${encodeURIComponent(profileUsername)}&me=${encodeURIComponent(ownUsername)}`).then(r => r.json());
      setIsFollowing(res.following || false);
    } catch {}
  }, [ownUsername, profileUsername, isOwn]);

  const fetchLibrary = useCallback(async () => {
    if (!effectiveUsername) return;
    try {
      const res = await fetch(`/api/library?username=${encodeURIComponent(effectiveUsername)}`).then(r => r.json());
      setLibrary(res.items || []);
    } catch {}
  }, [effectiveUsername]);

  const fetchProfileData = useCallback(async () => {
    if (!effectiveUsername) return;
    try {
      const res = await fetch(`/api/profile?username=${encodeURIComponent(effectiveUsername)}`).then(r => r.json());
      setAvatarUrl(res.avatar_url || null);
      setBackgroundUrl(res.background_url || null);
      setIsPremium(res.is_premium || false);
      if (res.joined_at) setJoinedDate(res.joined_at);
      if (isOwn) {
        setBgScale(res.background_scale ?? 100);
        setBgPositionX(res.background_position_x ?? 50);
        setBgPositionY(res.background_position_y ?? 50);
      }
    } catch {}
  }, [effectiveUsername, isOwn]);

  const fetchReviewsMap = useCallback(async () => {
    if (!effectiveUsername) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(effectiveUsername)}/reviews`).then(r => r.json());
      if (res.reviews) {
        const map: Record<string, string> = {};
        for (const r of res.reviews) {
          const key = `${r.tmdb_id}-${r.media_type}`;
          if (!map[key]) map[key] = r.content?.split("\n")[0] || "";
        }
        setReviewsMap(map);
      }
    } catch {}
  }, [effectiveUsername]);

  const fetchStats = useCallback(async (mt?: string) => {
    if (!effectiveUsername) return;
    try {
      const mediaType = mt ?? "movie";
      const res = await fetch(`/api/users/${encodeURIComponent(effectiveUsername)}/stats?mediaType=${mediaType}`).then(r => r.json());
      if (!res.error) setStats(res);
    } catch {}
  }, [effectiveUsername]);

  const fetchCompare = useCallback(async () => {
    if (!effectiveUsername || isOwn || !ownUsername) { setCompareData(null); return; }
    setCompareLoading(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(effectiveUsername)}/compare?me=${encodeURIComponent(ownUsername)}`).then(r => r.json());
      if (!res.error) setCompareData(res);
    } catch {}
    setCompareLoading(false);
  }, [effectiveUsername, isOwn, ownUsername]);

  const fetchFollowList = useCallback((type: "followers" | "following") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", type);
    router.push(`/profile?${params.toString()}`);
  }, [searchParams, router]);

  useEffect(() => {
    if (!tab || !effectiveUsername) return;
    setFollowListLoading(true);
    fetch(`/api/follow?username=${encodeURIComponent(effectiveUsername)}&type=${tab}&detail=true`)
      .then(r => r.json())
      .then(data => { setFollowList(data.users || []); setFollowListLoading(false); })
      .catch(() => setFollowListLoading(false));
  }, [tab, effectiveUsername]);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user?.created_at) setJoinedDate(data.user.created_at);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (ownUsername) {
      supabase.from("users").select("role").eq("username", ownUsername).maybeSingle()
        .then(({ data: rows }) => {
          const role = (rows as any)?.role;
          setIsAdmin(role === "admin" || role === "moderator");
          setUserRole(role || null);
        }, () => {});
    } else { setIsAdmin(false); }
  }, [ownUsername]);

  useEffect(() => {
    if (!isOwn || !ownUsername) return;
    fetch("/api/notifications").then(r => r.json()).then(d => {
      setNotifications(d.notifications || []);
      setUnreadCount(d.unread || 0);
    }).catch(() => {});
  }, [ownUsername, isOwn]);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mark_all_read: true }) });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markOneRead(id: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  async function deleteNotification(id: string) {
    const wasUnread = notifications.find(n => n.id === id)?.read === false;
    await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
  }

  useEffect(() => {
    if (mounted) { fetchFollowData(); fetchFollowStatus(); fetchLibrary(); fetchProfileData(); fetchStats(); fetchReviewsMap(); }
  }, [mounted, fetchFollowData, fetchFollowStatus, fetchLibrary, fetchProfileData, fetchStats, fetchReviewsMap]);

  useEffect(() => { if (mounted && effectiveUsername) fetchCompare(); }, [mounted, effectiveUsername, fetchCompare]);

  useEffect(() => {
    if (!user || activeView !== "reviews" || !effectiveUsername) return;
    setReviewsLoading(true);
    fetch(`/api/users/${encodeURIComponent(effectiveUsername)}/reviews`)
      .then(r => r.json()).then(data => { setUserReviews(data.reviews || []); setReviewsLoading(false); })
      .catch(() => setReviewsLoading(false));
  }, [activeView, effectiveUsername, user]);

  async function handleFollow() {
    if (!ownUsername || !profileUsername) return;
    setBounce(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch("/api/follow", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ followingUsername: profileUsername }) });
      if (res.ok) { setIsFollowing(!isFollowing); setFollowersCount(prev => isFollowing ? prev - 1 : prev + 1); }
    } catch {}
    setTimeout(() => setBounce(false), 400);
  }

  if (!mounted) return <ProfileSkeleton />;
  if (loading) return <ProfileSkeleton />;

  // ── Tab page: Followers / Following ──
  if (tab === "followers" || tab === "following") {
    const tabLabel = tab === "followers" ? "Followers" : "Following";
    return (
      <ErrorBoundary sectionName={`Profile ${tabLabel}`}>
        <div className="w-[896px] max-w-full mx-auto pb-32">
          <div className="flex items-center gap-4 px-4 pt-4 pb-3">
            <button onClick={() => { const params = new URLSearchParams(searchParams.toString()); params.delete("tab"); router.push(`/profile?${params.toString()}`); }}
              className="text-text-secondary hover:text-text-primary transition-colors">← Back</button>
            <h1 className="text-lg font-bold text-text-primary">{effectiveUsername ? `@${effectiveUsername}` : ""} · {tabLabel}</h1>
          </div>
          <div className="px-4">
            {followListLoading ? (
              <div className="space-y-3 mt-2">
                {[1, 2, 3].map(i => (<div key={i} className="bg-bg-card border border-border rounded-xl p-4 animate-pulse"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full bg-bg-card-hover" /><div className="flex-1"><div className="h-4 w-24 bg-bg-card-hover rounded mb-2" /><div className="h-3 w-32 bg-bg-card-hover rounded" /></div></div></div>))}
              </div>
            ) : followList.length === 0 ? (
              <p className="text-center text-text-secondary py-12">{tab === "followers" ? "No followers yet" : "Not following anyone yet"}</p>
            ) : (
              <div className="space-y-2 mt-2">
                {followList.map((u: any) => (
                  <a key={u.username} href={`/profile?username=${encodeURIComponent(u.username)}`} className="flex items-center gap-3 bg-bg-card border border-border rounded-xl p-3 hover:border-accent/50 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0">
                      <span className="text-base font-bold text-text-primary">{u.username[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">@{u.username}</p>
                      <p className="text-[10px] text-text-secondary">{u.ratingsCount || 0} ratings · {u.commentsCount || 0} comments</p>
                    </div>
                    {!u.isFollowing && u.username !== ownUsername && user && (
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); fetch("/api/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ followingUsername: u.username }) }).then(() => { setFollowList(prev => prev.map(f => f.username === u.username ? { ...f, isFollowing: true } : f)); }); }}
                        className="px-3 py-1.5 bg-accent hover:bg-[#818cf8] text-white text-xs font-medium rounded-lg transition-colors">Follow</button>
                    )}
                    {u.isFollowing && u.username !== ownUsername && <span className="text-[10px] text-text-secondary px-2">Following</span>}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // ── Main profile page ──
  const displayName = profileUsername || ownUsername || (user ? localStorageUsername : null) || "Guest";
  const joinLabel = joinedDate ? new Date(joinedDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;

  return (
    <ErrorBoundary sectionName="Profile">
    <div className="w-[896px] max-w-full mx-auto pb-32">
      {/* Cover area */}
      <div className={`relative w-full h-48 md:h-72 overflow-hidden ${backgroundUrl ? "" : "bg-gradient-to-br from-[#6366f1] via-[#7c3aed] to-[#a855f7]"}`}
        style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: "cover", backgroundPosition: `${bgPositionX}% ${bgPositionY}%`, backgroundRepeat: "no-repeat" } : undefined}>
        {!backgroundUrl && (
          <div className="absolute inset-0 overflow-hidden opacity-20">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white" />
            <div className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full bg-white" />
          </div>
        )}
      </div>

      {/* Avatar + Info */}
      <div className="relative px-6 -mt-10">
        <div className="flex items-end gap-4 mb-4">
          <div className="relative flex-shrink-0 flex items-end gap-3">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${!avatarUrl ? "bg-gradient-to-br from-[#6366f1] to-[#a855f7]" : ""}`}>
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <img src="/icons/default-avatar.png" alt="" className="w-full h-full object-cover" />}
            </div>
            {joinLabel && <span className="text-xs text-text-secondary pb-1 whitespace-nowrap">Since {joinLabel}</span>}
          </div>
          <div className="flex-1" />
          {isOwn && user ? (
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)}
                className="relative px-3 py-2 rounded-xl text-sm font-medium bg-bg-card border border-border hover:border-accent/40 transition-colors mb-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                    {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-accent hover:underline">Mark all read</button>}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? <div className="px-4 py-8 text-center text-text-secondary text-sm">No notifications yet.</div> : notifications.slice(0, 20).map((n: any) => (
                      <div key={n.id} className={`px-4 py-3 border-b border-border/50 hover:bg-bg-surface transition-colors group ${!n.read ? "bg-accent/5" : "opacity-60"}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-sm mt-0.5">{n.type === "announcement" ? "📢" : n.type === "like" ? "❤️" : n.type === "follow" ? "👤" : n.type === "comment" ? "💬" : "🔔"}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm text-text-primary leading-snug line-clamp-3 ${n.read ? "line-through decoration-text-secondary/40" : ""}`}>{n.title_name || n.message || "Notification"}</p>
                            {n.actor_username && n.type !== "announcement" && <p className="text-xs text-text-secondary mt-0.5">from @{n.actor_username}</p>}
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-[10px] text-text-secondary">{new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                              <button onClick={(e) => { e.stopPropagation(); markOneRead(n.id); }} className={`text-[10px] hover:underline ${n.read ? "text-text-secondary" : "text-accent"}`}>{n.read ? "Read" : "Mark read"}</button>
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            {!n.read && <span className="w-2 h-2 bg-accent rounded-full mt-2" />}
                            <button onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }} className="text-text-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-sm leading-none" title="Delete">✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : !isOwn && user ? (
            <button onClick={handleFollow} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 mb-1 ${bounce ? "scale-110" : "scale-100"} ${isFollowing ? "bg-bg-card border border-border text-text-secondary hover:text-red-400 hover:border-red-500" : "bg-accent text-white hover:bg-[#818cf8] shadow-lg shadow-[#6366f1]/25"}`}>
              {isFollowing ? "Following" : "Follow"}
            </button>
          ) : !isOwn && !user ? (
            <a href="/login" className="px-5 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-[#818cf8] shadow-lg shadow-[#6366f1]/25 transition-colors mb-1">Follow</a>
          ) : null}
        </div>

        {/* Name + Badge + Since */}
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-text-primary">@{displayName}</h1>
          {isPremium && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-full text-[11px] font-semibold text-amber-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Golden Ticket
            </span>
          )}
          {(isOwn && user) && (
            <>
            <button onClick={() => router.push("/profile/settings")} className="ml-1 w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-all" title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button onClick={async () => { const sb = createClient(); await sb.auth.signOut(); localStorage.removeItem("seriez-username"); router.push("/"); router.refresh(); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all" title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
            </>
          )}
        </div>
        <div className="flex gap-5 mt-1 text-sm text-text-secondary">
          {user ? (<>
            <button onClick={() => fetchFollowList("followers")} className="hover:text-text-primary transition-colors"><strong className="text-text-primary">{followersCount}</strong> followers</button>
            <button onClick={() => fetchFollowList("following")} className="hover:text-text-primary transition-colors"><strong className="text-text-primary">{followingCount}</strong> following</button>
          </>) : (<>
            <span className="pointer-events-none"><strong className="text-text-primary">—</strong> followers</span>
            <span className="pointer-events-none"><strong className="text-text-primary">—</strong> following</span>
          </>)}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="px-6 mt-6">
        <div className="flex border-b border-border/60">
          {[
            { id: "profile" as const, label: "Profile" },
            { id: "insights" as const, label: "Insights" },
            { id: "ott" as const, label: "OTT", mobile: true },
            { id: "reviews" as const, label: "Reviews" },
          ].filter(t => !t.mobile || true).map(tab => (
            <button key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`relative px-5 py-3 text-sm font-medium transition-all duration-200 ${
                activeView === tab.id
                  ? "text-accent"
                  : "text-text-secondary hover:text-text-primary"
              } ${tab.mobile && tab.id === "ott" ? "md:hidden" : ""}`}>
              {tab.label}
              {activeView === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />}
            </button>
          ))}
          {isAdmin && (
            <button onClick={() => setActiveView("admin")}
              className={`relative px-5 py-3 text-sm font-medium transition-all duration-200 ${
                activeView === "admin" ? "text-red-400" : "text-text-secondary hover:text-red-400"
              }`}>
              Admin
              {activeView === "admin" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400 rounded-full" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Profile View ── */}
      {activeView === "profile" && (<>
      {!user ? (
        <div className="px-6 mt-5 pb-32">
          <div className="bg-bg-card border border-border rounded-2xl p-8 text-center">
            <span className="text-5xl block mb-4">🔒</span>
            <h2 className="text-lg font-bold text-text-primary mb-2">Sign in to see full profile</h2>
            <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-4">Track what you watch, discover new favorites, and connect with friends</p>
            <a href="/login" className="inline-block px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-[#818cf8] transition-colors">Sign In / Sign Up</a>
          </div>
        </div>
      ) : (<>

      {/* Stats Dashboard */}
      {stats && (
        <div className="px-6 mt-5">
          <div className="flex justify-center mb-4">
            <div className="inline-flex bg-bg-card rounded-full p-0.5 border border-border">
              {(["movie", "tv", "anime"] as const).map((type) => {
                const labels: Record<string, string> = { movie: "Movie", tv: "TV", anime: "Anime" };
                return (
                  <button key={type} onClick={() => { setSelectedMediaType(type); fetchStats(type); }}
                    className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${selectedMediaType === type ? "bg-accent text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>
                    {labels[type]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-text-primary">{stats.totals.watched}</p>
              <p className="text-[10px] text-text-secondary uppercase tracking-wide mt-0.5">Watched</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-text-primary">{stats.totals.hours}h</p>
              <p className="text-[10px] text-text-secondary uppercase tracking-wide mt-0.5">Hours</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{stats.rating.average || "—"}</p>
              <p className="text-[10px] text-text-secondary uppercase tracking-wide mt-0.5">Avg ★</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-text-primary">{stats.totals.rated}</p>
              <p className="text-[10px] text-text-secondary uppercase tracking-wide mt-0.5">Rated</p>
            </div>
          </div>
        </div>
      )}

      {/* Favorites 4 */}
      {stats && library.length > 0 && (
        <div className="px-6 mt-5 space-y-5">
          {(() => {
            const favs = library.filter(l => l.rating && l.rating >= 4 && (l as any).mediaType === selectedMediaType).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
            if (favs.length < 2) return null;
            return (
              <div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">Favorites</h3>
                <div className="grid grid-cols-4 gap-2">
                  {favs.map((item) => (
                    <a key={(item as any).tmdbId} href={`/title/${(item as any).tmdbId}?type=${(item as any).mediaType}`}
                      className="bg-bg-card border border-border rounded-lg overflow-hidden hover:border-accent/40 transition-colors group">
                      <div className="aspect-[2/3] bg-bg-surface relative">
                        {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>}
                        <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-0.5"><span className="text-yellow-400 text-[10px]">★</span><span className="text-white text-[10px] font-bold">{item.rating}</span></div>
                      </div>
                      <div className="p-1.5"><p className="text-[10px] text-text-primary font-medium truncate">{item.title}</p>{item.year && <p className="text-[9px] text-text-secondary mt-0.5">{item.year}</p>}</div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Taste Comparison */}
      {!isOwn && user && compareData && !compareLoading && (
        <div className="px-6 mt-6 space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#818cf8] to-[#a78bfa] flex items-center justify-center flex-shrink-0"><span className="text-text-primary text-xs">♡</span></div>
            <span className="text-sm text-text-secondary">Taste Match</span>
            <span className="text-2xl font-bold text-text-primary ml-auto">{compareData.matchRate}%</span>
          </div>
          {compareData.bothEnjoyed.length > 0 && (
            <div>
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-2 px-1">Both Enjoyed</h3>
              <div className="space-y-2">
                {compareData.bothEnjoyed.slice(0, 3).map((item, i) => (
                  <a key={i} href={`/title/${item.tmdbId}?type=${item.mediaType}`} className="flex items-center gap-3 bg-bg-card border border-border rounded-xl p-3 hover:border-accent/40 transition-colors">
                    <div className="w-14 h-[84px] rounded-lg overflow-hidden bg-bg-primary flex-shrink-0">{item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-text-primary/15 text-lg">🎬</div>}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm text-text-primary font-medium truncate">{item.title}</p>{item.year && <p className="text-[11px] text-text-secondary mt-0.5">{item.year}</p>}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
          {compareData.divergent.length > 0 && (
            <div>
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-2 px-1">Ratings Apart</h3>
              <div className="space-y-2">
                {compareData.divergent.slice(0, 3).map((item, i) => (
                  <a key={i} href={`/title/${item.tmdbId}?type=${item.mediaType}`} className="flex items-center gap-3 bg-bg-card border border-border rounded-xl p-3 hover:border-accent/40 transition-colors">
                    <div className="w-14 h-[84px] rounded-lg overflow-hidden bg-bg-primary flex-shrink-0">{item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-text-primary/15 text-lg">🎬</div>}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-4 mt-1.5">
                        <div className="flex items-center gap-1.5"><span className="text-[10px] text-text-secondary w-8">You</span><div className="flex items-center gap-1"><span className="text-sm font-semibold text-[#818cf8]">{item.myRating}</span><span className="text-[10px] text-[#818cf8]/60">★</span></div></div>
                        <div className="w-px h-4 bg-border" />
                        <div className="flex items-center gap-1.5"><span className="text-[10px] text-text-secondary w-8">Them</span><div className="flex items-center gap-1"><span className="text-sm font-semibold text-gold">{item.theirRating}</span><span className="text-[10px] text-gold/60">★</span></div></div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Directors + Actors */}
      {stats && stats.topDirectors && stats.topDirectors.length > 0 && (
        <div className="px-6 mt-6">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide">{isFavoriteMode ? "Favorite Directors" : "Top Directors"}</h3>
            {isOwn && (
              <button onClick={async () => {
                if (!isFavoriteMode && effectiveUsername) {
                  try {
                    const uid = (user as any)?.id || "";
                    if (favoriteDirectors.length === 0) { const dRes = await fetch(`/api/persons/likes?username=${encodeURIComponent(effectiveUsername)}&role=director&userId=${uid}`); const dData = await dRes.json(); setFavoriteDirectors(dData.likes || []); }
                    if (favoriteActors.length === 0) { const aRes = await fetch(`/api/persons/likes?username=${encodeURIComponent(effectiveUsername)}&role=actor&userId=${uid}`); const aData = await aRes.json(); setFavoriteActors(aData.likes || []); }
                  } catch {}
                }
                setIsFavoriteMode(!isFavoriteMode);
              }} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isFavoriteMode ? "bg-accent" : "bg-bg-surface border border-border"}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isFavoriteMode ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
              </button>
            )}
          </div>
          {isFavoriteMode ? (favoriteDirectors.length > 0 ? <div className="flex flex-wrap gap-2">{favoriteDirectors.slice(0, 8).map((d: any) => (<a key={`${d.person_source}-${d.person_id}`} href={`/person/${d.person_source === "anilist" ? "anilist/" : ""}${d.person_id}`} className="flex items-center gap-2 px-2 py-1.5 bg-bg-card border border-border rounded-lg hover:bg-bg-surface transition-colors">{d.person_image && <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-surface flex-shrink-0"><img src={d.person_image} alt={d.person_name} className="w-full h-full object-cover" /></div>}<span className="text-xs text-text-primary">{d.person_name}</span></a>))}</div> : <p className="text-xs text-text-secondary">No favorite directors yet.</p>) : <div className="flex flex-wrap gap-2">{stats.topDirectors.slice(0, 5).map((d) => (d.personId ? <a key={d.name} href={`/person/${d.personSource === "anilist" ? "anilist/" : ""}${d.personId}`} className="flex items-center gap-2 px-2 py-1.5 bg-bg-card border border-border rounded-lg hover:bg-bg-surface transition-colors">{d.image && <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-surface flex-shrink-0"><img src={d.image} alt={d.name} className="w-full h-full object-cover" /></div>}<span className="text-xs text-text-primary">{d.name}</span></a> : <span key={d.name} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-primary">{d.name}</span>))}</div>}
        </div>
      )}
      {stats && stats.topActors && stats.topActors.length > 0 && (
        <div className="px-6 mt-5">
          <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">{isFavoriteMode ? "Favorite Actors" : "Top Actors"}</h3>
          {isFavoriteMode ? (favoriteActors.length > 0 ? <div className="flex flex-wrap gap-2">{favoriteActors.slice(0, 8).map((a: any) => (<a key={`${a.person_source}-${a.person_id}`} href={`/person/${a.person_source === "anilist" ? "anilist/" : ""}${a.person_id}`} className="flex items-center gap-2 px-2 py-1.5 bg-bg-card border border-border rounded-lg hover:bg-bg-surface transition-colors">{a.person_image && <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-surface flex-shrink-0"><img src={a.person_image} alt={a.person_name} className="w-full h-full object-cover" /></div>}<span className="text-xs text-text-primary">{a.person_name}</span></a>))}</div> : <p className="text-xs text-text-secondary">No favorite actors yet.</p>) : <div className="flex flex-wrap gap-2">{stats.topActors.slice(0, 5).map((a) => (a.personId ? <a key={a.name} href={`/person/${a.personId}`} className="flex items-center gap-2 px-2 py-1.5 bg-bg-card border border-border rounded-lg hover:bg-bg-surface transition-colors">{a.image && <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-surface flex-shrink-0"><img src={a.image} alt={a.name} className="w-full h-full object-cover" /></div>}<span className="text-xs text-text-primary">{a.name}</span></a> : <span key={a.name} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-primary">{a.name}</span>))}</div>}
        </div>
      )}
      </>)}
      {user && effectiveUsername && (<div className="mt-6"><HistoryClient profileUsername={effectiveUsername} isOwn={isOwn} /></div>)}
      </>)}

      {/* ── Insights View ── */}
      {activeView === "insights" && isOwn && (
        <div className="px-6 mt-5 space-y-6 pb-32">
          {!user ? (
            <div className="bg-bg-card border border-border rounded-2xl p-8 text-center"><span className="text-5xl block mb-4">🔒</span><h2 className="text-lg font-bold text-text-primary mb-2">Sign in to see Insights</h2><p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-4">Track your watching habits, discover patterns, and unlock your personal Viewer DNA.</p><a href="/login" className="inline-block px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-[#818cf8] transition-colors">Sign In / Sign Up</a></div>
          ) : !stats ? (
            <div className="space-y-5"><div className="bg-bg-card border border-border rounded-2xl p-6 animate-pulse"><div className="h-4 w-32 bg-bg-card-hover rounded mb-4" /><div className="h-48 bg-bg-card-hover rounded-xl" /></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="bg-bg-card border border-border rounded-xl p-4 animate-pulse"><div className="h-8 w-12 bg-bg-card-hover rounded mb-2" /><div className="h-3 w-16 bg-bg-card-hover rounded" /></div>)}</div></div>
          ) : !isPremium ? (
            <div className="bg-bg-card border border-border rounded-2xl p-8 text-center"><span className="text-5xl block mb-4">⭐</span><h2 className="text-lg font-bold text-text-primary mb-2">Unlock Insights with Golden Ticket</h2><p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-4">Insights — including Yearly Recap, genre breakdowns, and your Viewer DNA — are exclusive to Golden Ticket members.</p><a href="/pro" className="inline-block px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-[#818cf8] transition-colors">Get Golden Ticket</a></div>
          ) : (<>
            {stats.yearlyRecap && stats.yearlyRecap.titles > 0 && (
              <YearlyRecapSlideshow hours={stats.yearlyRecap.hours} titles={stats.yearlyRecap.titles} ratingAvg={stats.rating.average || "—"} ratedCount={stats.totals.rated} topGenre={stats.genres?.[0]?.name || "Film"} topGenreCount={stats.genres?.[0]?.count || 0} allGenres={stats.genres || []} topActors={stats.topActors || []} displayName={displayName} mediaBreakdown={stats.mediaBreakdown} mediaHours={stats.mediaHours || { movie: 0, tv: 0, anime: 0 }} library={library} reviewsMap={reviewsMap} />
            )}
            {stats.genres && stats.genres.length > 0 && (
              <div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">Top Genres</h3>
                <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
                  {stats.genres.slice(0, 8).map((g, i) => {
                    const max = stats.genres?.[0]?.count || 1;
                    const pct = Math.round((g.count / max) * 100);
                    return (<div key={g.name} className="flex items-center gap-3"><span className="text-xs text-text-secondary w-5 text-right tabular-nums">{i + 1}</span><div className="flex-1 min-w-0"><div className="flex justify-between mb-1"><span className="text-xs text-text-primary font-medium truncate">{g.name}</span><span className="text-[10px] text-text-secondary ml-2">{g.count}</span></div><div className="h-1.5 bg-bg-surface rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-accent to-[#a855f7] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div></div></div>);
                  })}
                </div>
              </div>
            )}
            <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-5"><div className="flex items-center gap-2 mb-1"><h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide">Viewer DNA</h3></div><p className="text-xs text-text-secondary leading-relaxed">Your watching personality, decoded from your ratings and reviews.</p></div>
              <div className="border-t border-border px-5 py-4 space-y-3">
                <div className="flex items-center gap-3"><span className="text-3xl">🧬</span><div><p className="text-sm font-semibold text-text-primary">Your Profile</p><p className="text-xs text-text-secondary">Based on {stats.totals.reviewed || 0} reviews</p></div></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-bg-surface rounded-lg p-3"><p className="text-[9px] text-text-secondary uppercase tracking-wide mb-1">Style</p>{stats?.viewerDNA?.styleReady ? <><p className="text-sm font-medium text-text-primary">{stats.viewerDNA.style}</p>{stats.viewerDNA.styleDescription && <p className="text-[10px] text-text-secondary mt-1 leading-tight">{stats.viewerDNA.styleDescription}</p>}</> : <><p className="text-sm font-medium text-text-primary">Analyzing...</p>{stats?.viewerDNA?.styleStatus && <p className="text-[10px] text-text-secondary mt-1 leading-tight">{stats.viewerDNA.styleStatus}</p>}</>}</div>
                  <div className="bg-bg-surface rounded-lg p-3"><p className="text-[9px] text-text-secondary uppercase tracking-wide mb-1">Taste</p>{stats?.viewerDNA?.tasteReady ? <><p className="text-sm font-medium text-text-primary">{stats.viewerDNA.taste}</p>{stats.viewerDNA.tasteDescription && <p className="text-[10px] text-text-secondary mt-1 leading-tight">{stats.viewerDNA.tasteDescription}</p>}</> : <><p className="text-sm font-medium text-text-primary">Analyzing...</p>{stats?.viewerDNA?.tasteStatus && <p className="text-[10px] text-text-secondary mt-1 leading-tight">{stats.viewerDNA.tasteStatus}</p>}</>}</div>
                </div>
              </div>
            </div>
          </>)}
        </div>
      )}

      {/* ── OTT View ── */}
      {activeView === "ott" && (<div className="px-4 mt-5 pb-32 md:hidden"><StreamingTop10 /></div>)}

      {/* ── Reviews View ── */}
      {activeView === "reviews" && isOwn && (
        <div className="px-6 mt-5 pb-32">
          {!user ? (
            <div className="bg-bg-card border border-border rounded-2xl p-8 text-center"><span className="text-5xl block mb-4">🔒</span><h2 className="text-lg font-bold text-text-primary mb-2">Sign in to see reviews</h2><p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-4">Your reviews and ratings will appear here.</p><a href="/login" className="inline-block px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-[#818cf8] transition-colors">Sign In / Sign Up</a></div>
          ) : reviewsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => (<div key={i} className="bg-bg-card border border-border rounded-xl p-4 animate-pulse"><div className="flex gap-3"><div className="w-12 h-[72px] bg-bg-card-hover rounded-lg flex-shrink-0" /><div className="flex-1"><div className="h-4 w-32 bg-bg-card-hover rounded mb-2" /><div className="h-3 w-20 bg-bg-card-hover rounded mb-3" /><div className="h-3 w-full bg-bg-card-hover rounded" /></div></div></div>))}</div>
          ) : userReviews.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-2xl p-8 text-center"><span className="text-5xl block mb-4">📝</span><h2 className="text-lg font-bold text-text-primary mb-2">No reviews yet</h2><p className="text-sm text-text-secondary leading-relaxed">Reviews you write will appear here.</p></div>
          ) : (
            <div className="space-y-3">{userReviews.map((review, i) => (
              <a key={i} href={`/title/${review.tmdb_id}?type=${review.media_type}`} className="flex gap-3 bg-bg-card border border-border rounded-xl p-3 hover:border-accent/40 transition-colors">
                <div className="w-12 h-[72px] rounded-lg overflow-hidden bg-bg-surface flex-shrink-0">{review.poster ? <img src={review.poster} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-lg">🎬</div>}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-text-primary truncate">{review.title}</p><div className="flex items-center gap-2 mt-0.5 mb-1.5"><div className="flex items-center gap-0.5">{[1,2,3,4,5].map(s => <span key={s} className={`text-[10px] ${s <= (review.rating || 0) ? "text-yellow-400" : "text-text-secondary/30"}`}>★</span>)}</div>{review.year && <span className="text-[10px] text-text-secondary">{review.year}</span>}{review.created_at && <span className="text-[10px] text-text-secondary">{new Date(review.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}</div>{review.content && <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{review.content}</p>}</div>
              </a>
            ))}</div>
          )}
        </div>
      )}

      {/* ── Admin View ── */}
      {activeView === "admin" && isAdmin && <AdminPanel userRole={userRole} />}
    </div>
    </ErrorBoundary>
  );
}
