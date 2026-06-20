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
  const [activeView, setActiveView] = useState<"profile" | "insights" | "ott" | "reviews">("profile");
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [isFavoriteMode, setIsFavoriteMode] = useState(false);
  const [favoriteDirectors, setFavoriteDirectors] = useState<any[]>([]);
  const [favoriteActors, setFavoriteActors] = useState<any[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const profileUsername = searchParams.get("username");
  const tab = searchParams.get("tab"); // "followers" | "following" | null
  const ownUsername = user?.user_metadata?.username;
  const localStorageUsername = typeof window !== "undefined" ? localStorage.getItem("seriez-username") : null;
  const effectiveUsername = profileUsername || ownUsername || localStorageUsername;
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
        <div className="max-w-lg md:max-w-4xl mx-auto pb-32">
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
  const displayName = profileUsername || ownUsername || localStorageUsername || "Guest";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <ErrorBoundary sectionName="Profile">
    <div className="max-w-lg md:max-w-4xl mx-auto pb-32">
      {/* Cover area */}
      <div
        className={`relative h-40 ${backgroundUrl ? "" : "bg-gradient-to-br from-[#6366f1] via-[#7c3aed] to-[#a855f7]"}`}
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
          {!isOwn && user ? (
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
        </div>
      </div>

      {/* ── Profile View ── */}
      {activeView === "profile" && (
      <>
      {/* ── Content wrapper (for guest blur overlay) ── */}
      <div className="relative">
        <div className={!user ? "blur-lg pointer-events-none select-none opacity-60" : ""}>

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

      {/* Sign-in prompt for guests */}
      {!user && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 z-10">
          <p className="text-lg font-bold text-text-primary mb-2 text-center">Sign in to see full profile</p>
          <p className="text-xs text-text-secondary mb-5 text-center">Track what you watch, discover new favorites, and connect with friends</p>
          <a href="/login" className="px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-[#818cf8] transition-colors">
            Sign In / Sign Up
          </a>
        </div>
      )}

        </div>
      </div>

      {/* History — only for logged-in users */}
      {user && effectiveUsername && (
        <div className="mt-6">
          <HistoryClient profileUsername={effectiveUsername} isOwn={isOwn} />
        </div>
      )}
      </>
      )}

      {/* ── Insights View ── */}
      {activeView === "insights" && (
        <div className="px-4 mt-5 space-y-6 pb-32">
          {!user || !isOwn ? (
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
      {activeView === "reviews" && (
        <div className="px-4 mt-5 pb-32">
          {!user || !isOwn ? (
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
    </div>
    </ErrorBoundary>
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
