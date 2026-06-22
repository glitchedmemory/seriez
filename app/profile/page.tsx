"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileSkeleton } from "@/components/Skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";
import HistoryClient from "@/app/history/HistoryClient";
import YearlyRecapSlideshow from "@/components/YearlyRecapSlideshow";
import { StreamingTop10 } from "@/components/StreamingTop10";

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
  const [user, setUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const profileUsername = searchParams.get("username");
  const tab = searchParams.get("tab"); // "followers" | "following" | null
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
      const params = `?mediaType=${mediaType}`;
      const res = await fetch(`/api/users/${encodeURIComponent(effectiveUsername)}/stats${params}`).then(r => r.json());
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

  const fetchFollowList = useCallback(async (type: "followers" | "following") => {
    // Navigate to dedicated tab page
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", type);
    router.push(`/profile?${params.toString()}`);
  }, [searchParams, router]);

  // Fetch follow list data when on tab page
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
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Admin role check (only for authenticated users, never from localStorage)
  useEffect(() => {
    if (ownUsername) {
      supabase.from("users").select("role").eq("username", ownUsername).maybeSingle()
        .then(
          ({ data: rows }) => {
            const role = (rows as any)?.role;
            setIsAdmin(role === "admin" || role === "moderator");
            setUserRole(role || null);
          },
          () => {}
        );
    } else {
      setIsAdmin(false);
    }
  }, [ownUsername]);

  // Fetch notifications (own profile only)
  useEffect(() => {
    if (!isOwn || !ownUsername) return;
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications || []);
        setUnreadCount(d.unread || 0);
      })
      .catch(() => {});
  }, [ownUsername, isOwn]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all_read: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markOneRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
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
    if (mounted) {
      fetchFollowData();
      fetchFollowStatus();
      fetchLibrary();
      fetchProfileData();
      fetchStats();
      fetchReviewsMap();
    }
  }, [mounted, fetchFollowData, fetchFollowStatus, fetchLibrary, fetchProfileData, fetchStats, fetchReviewsMap]);

  useEffect(() => {
    if (mounted && effectiveUsername) fetchCompare();
  }, [mounted, effectiveUsername, fetchCompare]);

  // Fetch reviews when Reviews tab selected
  useEffect(() => {
    if (!user || activeView !== "reviews" || !effectiveUsername) return;
    setReviewsLoading(true);
    fetch(`/api/users/${encodeURIComponent(effectiveUsername)}/reviews`)
      .then(r => r.json())
      .then(data => { setUserReviews(data.reviews || []); setReviewsLoading(false); })
      .catch(() => setReviewsLoading(false));
  }, [activeView, effectiveUsername, user]);

  async function handleFollow() {
    if (!ownUsername || !profileUsername) return;
    setBounce(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch("/api/follow", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingUsername: profileUsername }),
      });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        setFollowersCount((prev) => isFollowing ? prev - 1 : prev + 1);
      }
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
          {/* Header */}
          <div className="flex items-center gap-4 px-4 pt-4 pb-3">
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("tab");
                router.push(`/profile?${params.toString()}`);
              }}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-lg font-bold text-text-primary">
              {effectiveUsername ? `@${effectiveUsername}` : ""} · {tabLabel}
            </h1>
          </div>

          {/* List */}
          <div className="px-4">
            {followListLoading ? (
              <div className="space-y-3 mt-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-bg-card border border-border rounded-xl p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-bg-card-hover" />
                      <div className="flex-1">
                        <div className="h-4 w-24 bg-bg-card-hover rounded mb-2" />
                        <div className="h-3 w-32 bg-bg-card-hover rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : followList.length === 0 ? (
              <p className="text-center text-text-secondary py-12">
                {tab === "followers" ? "No followers yet" : "Not following anyone yet"}
              </p>
            ) : (
              <div className="space-y-2 mt-2">
                {followList.map((u: any) => (
                  <a
                    key={u.username}
                    href={`/profile?username=${encodeURIComponent(u.username)}`}
                    className="flex items-center gap-3 bg-bg-card border border-border rounded-xl p-3 hover:border-accent/50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0">
                      <span className="text-base font-bold text-text-primary">
                        {u.username[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">@{u.username}</p>
                      <p className="text-[10px] text-text-secondary">
                        {u.ratingsCount || 0} ratings · {u.commentsCount || 0} comments
                      </p>
                    </div>
                    {!u.isFollowing && u.username !== ownUsername && user && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          fetch(`/api/follow`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ followingUsername: u.username }),
                          }).then(() => {
                            setFollowList(prev =>
                              prev.map(f => f.username === u.username ? { ...f, isFollowing: true } : f)
                            );
                          });
                        }}
                        className="px-3 py-1.5 bg-accent hover:bg-[#818cf8] text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Follow
                      </button>
                    )}
                    {u.isFollowing && u.username !== ownUsername && (
                      <span className="text-[10px] text-text-secondary px-2">Following</span>
                    )}
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
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <ErrorBoundary sectionName="Profile">
    <div className="w-[896px] max-w-full mx-auto pb-32">
      {/* Cover area */}
      <div
        className={`relative h-48 md:h-72 ${backgroundUrl ? "" : "bg-gradient-to-br from-[#6366f1] via-[#7c3aed] to-[#a855f7]"}`}
        style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: `${bgScale}%`, backgroundPosition: `${bgPositionX}% ${bgPositionY}%`, backgroundRepeat: "no-repeat" } : undefined}
      >
        {!backgroundUrl && (
          <div className="absolute inset-0 overflow-hidden opacity-20">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white" />
            <div className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full bg-white" />
          </div>
        )}
      </div>

      {/* Avatar + Info */}
      <div className="relative px-4 -mt-10">
        <div className="flex items-end gap-4 mb-4">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-bg-primary shadow-xl overflow-hidden ${!avatarUrl ? "bg-gradient-to-br from-[#6366f1] to-[#a855f7]" : ""}`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-text-primary">{initial}</span>
            )}
          </div>
          <div className="flex-1" />
          {isOwn && user ? (
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative px-3 py-2 rounded-xl text-sm font-medium bg-bg-card border border-border hover:border-accent/40 transition-colors mb-1"
              >
                <span className="text-lg">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-accent hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-text-secondary text-sm">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.slice(0, 20).map((n: any) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b border-border/50 hover:bg-bg-surface transition-colors group ${!n.read ? "bg-accent/5" : "opacity-60"}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-sm mt-0.5">
                              {n.type === "announcement" ? "📢" : n.type === "like" ? "❤️" : n.type === "follow" ? "👤" : n.type === "comment" ? "💬" : "🔔"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm text-text-primary leading-snug line-clamp-3 ${n.read ? "line-through decoration-text-secondary/40" : ""}`}>
                                {n.title_name || n.message || "Notification"}
                              </p>
                              {n.actor_username && n.type !== "announcement" && (
                                <p className="text-xs text-text-secondary mt-0.5">from @{n.actor_username}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-[10px] text-text-secondary">
                                  {new Date(n.created_at).toLocaleDateString()}{" "}
                                  {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </p>
                                <button
                                  onClick={(e) => { e.stopPropagation(); markOneRead(n.id); }}
                                  className={`text-[10px] hover:underline ${n.read ? "text-text-secondary" : "text-accent"}`}
                                >
                                  {n.read ? "Read" : "Mark read"}
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              {!n.read && (
                                <span className="w-2 h-2 bg-accent rounded-full mt-2" />
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                                className="text-text-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-sm leading-none"
                                title="Delete"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : !isOwn && user ? (
            <button onClick={handleFollow}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 mb-1 ${
                bounce ? "scale-110" : "scale-100"
              } ${
                isFollowing
                  ? "bg-bg-card border border-border text-text-secondary hover:text-red-400 hover:border-red-500"
                  : "bg-accent text-white hover:bg-[#818cf8] shadow-lg shadow-[#6366f1]/25"
              }`}>
              {isFollowing ? "Following" : "Follow"}
            </button>
          ) : !isOwn && !user ? (
            <a href="/login"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-[#818cf8] shadow-lg shadow-[#6366f1]/25 transition-colors mb-1">
              Follow
            </a>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-text-primary">@{displayName}</h1>
          {(isOwn && user) && (
            <>
            <button
              onClick={() => router.push("/profile/settings")}
              className="text-text-secondary hover:text-text-primary transition-colors"
              title="Settings"
            >⚙️</button>
            <button
              onClick={async () => { const sb = createClient(); await sb.auth.signOut(); localStorage.removeItem("seriez-username"); router.push("/"); router.refresh(); }}
              className="text-text-secondary hover:text-red-400 transition-colors text-sm ml-1"
              title="Sign out"
            >🚪</button>
            </>
          )}
        </div>
        <div className="flex gap-5 mt-1 text-sm text-text-secondary">
          {user ? (
            <>
            <button onClick={() => fetchFollowList("followers")} className="hover:text-text-primary transition-colors">
              <strong className="text-text-primary">{followersCount}</strong> followers
            </button>
            <button onClick={() => fetchFollowList("following")} className="hover:text-text-primary transition-colors">
              <strong className="text-text-primary">{followingCount}</strong> following
            </button>
            </>
          ) : (
            <>
            <span className="pointer-events-none">
              <strong className="text-text-primary">—</strong> followers
            </span>
            <span className="pointer-events-none">
              <strong className="text-text-primary">—</strong> following
            </span>
            </>
          )}
        </div>
      </div>

      {/* ── View Tabs ── */}
      <div className="px-4 mt-5">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveView("profile")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeView === "profile"
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveView("insights")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeView === "insights"
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Insights
          </button>
          <button
            onClick={() => setActiveView("ott")}
            className={`md:hidden px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeView === "ott"
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            OTT
          </button>
          <button
            onClick={() => setActiveView("reviews")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeView === "reviews"
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Reviews
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveView("admin")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeView === "admin"
                  ? "border-red-400 text-red-400"
                  : "border-transparent text-text-secondary hover:text-red-400"
              }`}
            >
              🛡️ Admin
            </button>
          )}
        </div>
      </div>

      {/* ── Profile View ── */}
      {activeView === "profile" && (
      <>
      {!user ? (
        <div className="px-4 mt-5 pb-32">
          <div className="bg-bg-card border border-border rounded-2xl p-8 text-center">
            <span className="text-5xl block mb-4">🔒</span>
            <h2 className="text-lg font-bold text-text-primary mb-2">Sign in to see full profile</h2>
            <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-4">
              Track what you watch, discover new favorites, and connect with friends
            </p>
            <a href="/login" className="inline-block px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-[#818cf8] transition-colors">
              Sign In / Sign Up
            </a>
          </div>
        </div>
      ) : (
      <>

      {/* ── Stats Dashboard (FREE) ── */}
      {stats && (
        <div className="px-4 mt-5">
          {/* Segmented Media Type Toggle */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex bg-bg-card rounded-full p-0.5 border border-border">
              {(["movie", "tv", "anime"] as const).map((type) => {
                const labels: Record<string, string> = { movie: "Movie", tv: "TV", anime: "Anime" };
                const isActive = selectedMediaType === type;
                return (
                  <button
                    key={type}
                    onClick={() => { setSelectedMediaType(type); fetchStats(type); }}
                    className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                      isActive
                        ? "bg-accent text-white shadow-sm"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
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

      {/* ── Favorites 4 ── */}
      {stats && library.length > 0 && (
        <div className="px-4 mt-5 space-y-5">
          {/* Favorites 4 — top rated items */}
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
                        {item.poster ? (
                          <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                        )}
                        <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-0.5">
                          <span className="text-yellow-400 text-[10px]">★</span>
                          <span className="text-white text-[10px] font-bold">{item.rating}</span>
                        </div>
                      </div>
                      <div className="p-1.5">
                        <p className="text-[10px] text-text-primary font-medium truncate">{item.title}</p>
                        {item.year && <p className="text-[9px] text-text-secondary mt-0.5">{item.year}</p>}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Taste Comparison — only on other users' profiles */}
      {!isOwn && user && compareData && !compareLoading && (
        <div className="px-4 mt-6 space-y-4">
          {/* Match Rate — compact banner style */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#818cf8] to-[#a78bfa] flex items-center justify-center flex-shrink-0">
              <span className="text-text-primary text-xs">♡</span>
            </div>
            <span className="text-sm text-text-secondary">Taste Match</span>
            <span className="text-2xl font-bold text-text-primary ml-auto">{compareData.matchRate}%</span>
          </div>

          {/* Both Enjoyed */}
          {compareData.bothEnjoyed.length > 0 && (
            <div>
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-2 px-1">Both Enjoyed</h3>
              <div className="space-y-2">
                {compareData.bothEnjoyed.slice(0, 3).map((item, i) => (
                  <a key={i} href={`/title/${item.tmdbId}?type=${item.mediaType}`}
                    className="flex items-center gap-3 bg-bg-card border border-border rounded-xl p-3 hover:border-accent/40 transition-colors">
                    <div className="w-14 h-[84px] rounded-lg overflow-hidden bg-bg-primary flex-shrink-0">
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-primary/15 text-lg">🎬</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary font-medium truncate">{item.title}</p>
                      {item.year && <p className="text-[11px] text-text-secondary mt-0.5">{item.year}</p>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Ratings Apart */}
          {compareData.divergent.length > 0 && (
            <div>
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-2 px-1">Ratings Apart</h3>
              <div className="space-y-2">
                {compareData.divergent.slice(0, 3).map((item, i) => (
                  <a key={i} href={`/title/${item.tmdbId}?type=${item.mediaType}`}
                    className="flex items-center gap-3 bg-bg-card border border-border rounded-xl p-3 hover:border-accent/40 transition-colors">
                    <div className="w-14 h-[84px] rounded-lg overflow-hidden bg-bg-primary flex-shrink-0">
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-primary/15 text-lg">🎬</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-4 mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-text-secondary w-8">You</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-semibold text-[#818cf8]">{item.myRating}</span>
                            <span className="text-[10px] text-[#818cf8]/60">★</span>
                          </div>
                        </div>
                        <div className="w-px h-4 bg-border" />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-text-secondary w-8">Them</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-semibold text-gold">{item.theirRating}</span>
                            <span className="text-[10px] text-gold/60">★</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toggle + Directors Section */}
      {stats && stats.topDirectors && stats.topDirectors.length > 0 && (
        <div className="px-4 mt-6">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide">
              {isFavoriteMode ? "Favorite Directors" : "Top Directors"}
            </h3>
            {isOwn && (
              <button
                onClick={async () => {
                  if (!isFavoriteMode && effectiveUsername) {
                    try {
                      const uid = (user as any)?.id || "";
                      if (favoriteDirectors.length === 0) {
                        const dRes = await fetch(`/api/persons/likes?username=${encodeURIComponent(effectiveUsername)}&role=director&userId=${uid}`);
                        const dData = await dRes.json();
                        setFavoriteDirectors(dData.likes || []);
                      }
                      if (favoriteActors.length === 0) {
                        const aRes = await fetch(`/api/persons/likes?username=${encodeURIComponent(effectiveUsername)}&role=actor&userId=${uid}`);
                        const aData = await aRes.json();
                        setFavoriteActors(aData.likes || []);
                      }
                    } catch {}
                  }
                  setIsFavoriteMode(!isFavoriteMode);
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isFavoriteMode ? "bg-accent" : "bg-bg-surface border border-border"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    isFavoriteMode ? "translate-x-[18px]" : "translate-x-[2px]"
                  }`}
                />
              </button>
            )}
          </div>
          {isFavoriteMode ? (
            favoriteDirectors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {favoriteDirectors.slice(0, 8).map((d: any) => (
                  <a
                    key={`${d.person_source}-${d.person_id}`}
                    href={`/person/${d.person_source === "anilist" ? "anilist/" : ""}${d.person_id}`}
                    className="flex items-center gap-2 px-2 py-1.5 bg-bg-card border border-border rounded-lg hover:bg-bg-surface transition-colors"
                  >
                    {d.person_image && (
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-surface flex-shrink-0">
                        <img src={d.person_image} alt={d.person_name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <span className="text-xs text-text-primary">{d.person_name}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-secondary">No favorite directors yet. Visit a director&apos;s page and tap ♥</p>
            )
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.topDirectors.slice(0, 5).map((d) => (
                d.personId ? (
                  <a
                    key={d.name}
                    href={`/person/${d.personSource === "anilist" ? "anilist/" : ""}${d.personId}`}
                    className="flex items-center gap-2 px-2 py-1.5 bg-bg-card border border-border rounded-lg hover:bg-bg-surface transition-colors"
                  >
                    {d.image && (
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-surface flex-shrink-0">
                        <img src={d.image} alt={d.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <span className="text-xs text-text-primary">{d.name}</span>
                  </a>
                ) : (
                  <span key={d.name} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-primary">
                    {d.name}
                  </span>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toggle + Actors Section */}
      {stats && stats.topActors && stats.topActors.length > 0 && (
        <div className="px-4 mt-5">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide">
              {isFavoriteMode ? "Favorite Actors" : "Top Actors"}
            </h3>
          </div>
          {isFavoriteMode ? (
            favoriteActors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {favoriteActors.slice(0, 8).map((a: any) => (
                  <a
                    key={`${a.person_source}-${a.person_id}`}
                    href={`/person/${a.person_source === "anilist" ? "anilist/" : ""}${a.person_id}`}
                    className="flex items-center gap-2 px-2 py-1.5 bg-bg-card border border-border rounded-lg hover:bg-bg-surface transition-colors"
                  >
                    {a.person_image && (
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-surface flex-shrink-0">
                        <img src={a.person_image} alt={a.person_name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <span className="text-xs text-text-primary">{a.person_name}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-secondary">No favorite actors yet. Visit an actor&apos;s page and tap ♥</p>
            )
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.topActors.slice(0, 5).map((a) => (
                a.personId ? (
                  <a
                    key={a.name}
                    href={`/person/${a.personId}`}
                    className="flex items-center gap-2 px-2 py-1.5 bg-bg-card border border-border rounded-lg hover:bg-bg-surface transition-colors"
                  >
                    {a.image && (
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-surface flex-shrink-0">
                        <img src={a.image} alt={a.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <span className="text-xs text-text-primary">{a.name}</span>
                  </a>
                ) : (
                  <span key={a.name} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-primary">
                    {a.name}
                  </span>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sign-in for guests — now handled by ternary above */}
      </>
      )}

      {/* History — only for logged-in users */}
      {user && effectiveUsername && (
        <div className="mt-6">
          <HistoryClient profileUsername={effectiveUsername} isOwn={isOwn} />
        </div>
      )}
      </>
      )}

      {/* ── Insights View ── */}
      {activeView === "insights" && isOwn && (
        <div className="px-4 mt-5 space-y-6 pb-32">
          {!user ? (
            /* Guest: sign-in prompt */
            <div className="bg-bg-card border border-border rounded-2xl p-8 text-center">
              <span className="text-5xl block mb-4">🔒</span>
              <h2 className="text-lg font-bold text-text-primary mb-2">Sign in to see Insights</h2>
              <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-4">
                Track your watching habits, discover patterns, and unlock your personal Viewer DNA.
              </p>
              <a href="/login" className="inline-block px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-[#818cf8] transition-colors">
                Sign In / Sign Up
              </a>
            </div>
          ) : !stats ? (
            /* Loading skeleton */
            <div className="space-y-5">
              <div className="bg-bg-card border border-border rounded-2xl p-6 animate-pulse">
                <div className="h-4 w-32 bg-bg-card-hover rounded mb-4" />
                <div className="h-48 bg-bg-card-hover rounded-xl" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="bg-bg-card border border-border rounded-xl p-4 animate-pulse"><div className="h-8 w-12 bg-bg-card-hover rounded mb-2" /><div className="h-3 w-16 bg-bg-card-hover rounded" /></div>)}
              </div>
            </div>
          ) : !isPremium ? (
            /* Free user: Golden Ticket upsell */
            <div className="bg-bg-card border border-border rounded-2xl p-8 text-center">
              <span className="text-5xl block mb-4">⭐</span>
              <h2 className="text-lg font-bold text-text-primary mb-2">Unlock Insights with Golden Ticket</h2>
              <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-4">
                Insights — including Yearly Recap, genre breakdowns, and your Viewer DNA — are exclusive to Golden Ticket members.
              </p>
              <a href="/pro" className="inline-block px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-[#818cf8] transition-colors">
                Get Golden Ticket
              </a>
            </div>
          ) : (
            <>
              {/* ── Yearly Recap ── */}
              {stats.yearlyRecap && stats.yearlyRecap.titles > 0 && (
                <YearlyRecapSlideshow
                  hours={stats.yearlyRecap.hours}
                  titles={stats.yearlyRecap.titles}
                  ratingAvg={stats.rating.average || "—"}
                  ratedCount={stats.totals.rated}
                  topGenre={stats.genres?.[0]?.name || "Film"}
                  topGenreCount={stats.genres?.[0]?.count || 0}
                  allGenres={stats.genres || []}
                  topActors={stats.topActors || []}
                  displayName={displayName}
                  mediaBreakdown={stats.mediaBreakdown}
                  mediaHours={stats.mediaHours || { movie: 0, tv: 0, anime: 0 }}
                  library={library}
                  reviewsMap={reviewsMap}
                />
              )}

              {/* ── Top Genres ── */}
              {stats.genres && stats.genres.length > 0 && (
                <div>
                  <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">
                    Top Genres
                  </h3>
                  <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
                    {stats.genres.slice(0, 8).map((g, i) => {
                      const max = stats.genres?.[0]?.count || 1;
                      const pct = Math.round((g.count / max) * 100);
                      return (
                        <div key={g.name} className="flex items-center gap-3">
                          <span className="text-xs text-text-secondary w-5 text-right tabular-nums">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-text-primary font-medium truncate">{g.name}</span>
                              <span className="text-[10px] text-text-secondary ml-2">{g.count}</span>
                            </div>
                            <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-accent to-[#a855f7] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Viewer DNA ── */}
              <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide">Viewer DNA</h3>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Your watching personality, decoded from your ratings and reviews.
                  </p>
                </div>
                <div className="border-t border-border px-5 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🧬</span>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Your Profile</p>
                      <p className="text-xs text-text-secondary">Based on {stats.totals.reviewed || 0} reviews</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-bg-surface rounded-lg p-3">
                      <p className="text-[9px] text-text-secondary uppercase tracking-wide mb-1">Style</p>
                      {stats?.viewerDNA?.styleReady ? (
                        <>
                          <p className="text-sm font-medium text-text-primary">{stats.viewerDNA.style}</p>
                          {stats.viewerDNA.styleDescription && (
                            <p className="text-[10px] text-text-secondary mt-1 leading-tight">{stats.viewerDNA.styleDescription}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-text-primary">Analyzing...</p>
                          {stats?.viewerDNA?.styleStatus && (
                            <p className="text-[10px] text-text-secondary mt-1 leading-tight">{stats.viewerDNA.styleStatus}</p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="bg-bg-surface rounded-lg p-3">
                      <p className="text-[9px] text-text-secondary uppercase tracking-wide mb-1">Taste</p>
                      {stats?.viewerDNA?.tasteReady ? (
                        <>
                          <p className="text-sm font-medium text-text-primary">{stats.viewerDNA.taste}</p>
                          {stats.viewerDNA.tasteDescription && (
                            <p className="text-[10px] text-text-secondary mt-1 leading-tight">{stats.viewerDNA.tasteDescription}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-text-primary">Analyzing...</p>
                          {stats?.viewerDNA?.tasteStatus && (
                            <p className="text-[10px] text-text-secondary mt-1 leading-tight">{stats.viewerDNA.tasteStatus}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </>
          )}
        </div>
      )}

      {/* ── OTT View ── */}
      {activeView === "ott" && (
        <div className="px-4 mt-5 pb-32 md:hidden">
          <StreamingTop10 />
        </div>
      )}

      {/* ── Reviews View ── */}
      {activeView === "reviews" && isOwn && (
        <div className="px-4 mt-5 pb-32">
          {!user ? (
            <div className="bg-bg-card border border-border rounded-2xl p-8 text-center">
              <span className="text-5xl block mb-4">🔒</span>
              <h2 className="text-lg font-bold text-text-primary mb-2">Sign in to see reviews</h2>
              <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-4">
                Your reviews and ratings will appear here.
              </p>
              <a href="/login" className="inline-block px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-[#818cf8] transition-colors">
                Sign In / Sign Up
              </a>
            </div>
          ) : reviewsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-bg-card border border-border rounded-xl p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-12 h-[72px] bg-bg-card-hover rounded-lg flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-bg-card-hover rounded mb-2" />
                      <div className="h-3 w-20 bg-bg-card-hover rounded mb-3" />
                      <div className="h-3 w-full bg-bg-card-hover rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : userReviews.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-2xl p-8 text-center">
              <span className="text-5xl block mb-4">📝</span>
              <h2 className="text-lg font-bold text-text-primary mb-2">No reviews yet</h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                Reviews you write will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {userReviews.map((review, i) => (
                <a
                  key={i}
                  href={`/title/${review.tmdb_id}?type=${review.media_type}`}
                  className="flex gap-3 bg-bg-card border border-border rounded-xl p-3 hover:border-accent/40 transition-colors"
                >
                  <div className="w-12 h-[72px] rounded-lg overflow-hidden bg-bg-surface flex-shrink-0">
                    {review.poster ? (
                      <img src={review.poster} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">🎬</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{review.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 mb-1.5">
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-[10px] ${s <= (review.rating || 0) ? "text-yellow-400" : "text-text-secondary/30"}`}>★</span>
                        ))}
                      </div>
                      {review.year && <span className="text-[10px] text-text-secondary">{review.year}</span>}
                      {review.created_at && (
                        <span className="text-[10px] text-text-secondary">
                          {new Date(review.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    {review.content && (
                      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                        {review.content}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Admin View ── */}
      {activeView === "admin" && isAdmin && (
        <AdminPanel userRole={userRole} />
      )}
    </div>
    </ErrorBoundary>
  );
}

function AdminPanel({ userRole }: { userRole: string | null }) {
  type Section = "dashboard" | "reports" | "users" | "content" | "search" | "popular" | "activity" | "announce" | "sanctions" | "audit";
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
  const [contentType, setContentType] = useState("all"); // "all" | "review" | "comment" | "collection"
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
  // Search analytics
  const [searchTop, setSearchTop] = useState<any[]>([]);
  const [searchDaily, setSearchDaily] = useState<any[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  // Popular content
  const [popularTracked, setPopularTracked] = useState<any[]>([]);
  const [popularReviewed, setPopularReviewed] = useState<any[]>([]);
  const [popularCollected, setPopularCollected] = useState<any[]>([]);
  const [popularLoading, setPopularLoading] = useState(false);
  // User activity
  const [dau, setDau] = useState<any[]>([]);
  const [mostActive, setMostActive] = useState<any[]>([]);
  const [signupTrend, setSignupTrend] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  // Announce
  const [announceMessage, setAnnounceMessage] = useState("");
  const [announceSending, setAnnounceSending] = useState(false);
  const [announceResult, setAnnounceResult] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        const data = await res.json();
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
