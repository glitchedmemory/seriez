"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileSkeleton } from "@/components/Skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";
import HistoryClient from "@/app/history/HistoryClient";

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
  rating: { average: number; mostGiven: number; personality: string };
  mediaBreakdown: { movie: number; tv: number; anime: number };
  genres: { name: string; count: number }[];
  topActors: { name: string; count: number }[];
  topDirectors: { name: string; count: number }[];
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
    }
  }, [mounted, fetchFollowData, fetchFollowStatus, fetchLibrary, fetchProfileData, fetchStats]);

  useEffect(() => {
    if (mounted && effectiveUsername) fetchCompare();
  }, [mounted, effectiveUsername, fetchCompare]);

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
            <button
              onClick={() => router.push("/profile/settings")}
              className="text-text-secondary hover:text-text-primary transition-colors"
              title="Settings"
            >⚙️</button>
          )}
        </div>
        <div className="flex gap-5 mt-1 text-sm text-text-secondary">
          <button onClick={() => fetchFollowList("followers")} className="hover:text-text-primary transition-colors">
            <strong className="text-text-primary">{followersCount}</strong> followers
          </button>
          <button onClick={() => fetchFollowList("following")} className="hover:text-text-primary transition-colors">
            <strong className="text-text-primary">{followingCount}</strong> following
          </button>
        </div>
      </div>

      {/* ── Stats Dashboard (FREE) ── */}
      {stats && (
        <div className="px-4 mt-5">
          {/* Segmented Media Type Toggle */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex bg-white/5 dark:bg-white/5 bg-gray-100 rounded-full p-0.5">
              {(["movie", "tv", "anime"] as const).map((type) => {
                const labels: Record<string, string> = { movie: "Movie", tv: "TV", anime: "Anime" };
                const isActive = selectedMediaType === type;
                return (
                  <button
                    key={type}
                    onClick={() => { setSelectedMediaType(type); fetchStats(type); }}
                    className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#818cf8] text-white shadow-sm dark:bg-[#818cf8] dark:text-white bg-[#6366f1]"
                        : "text-text-secondary hover:text-text-primary dark:text-text-secondary dark:hover:text-white text-gray-500 hover:text-gray-700"
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

      {/* ── Favorites 4 + Media Breakdown (FREE) ── */}
      {stats && library.length > 0 && (
        <div className="px-4 mt-5 space-y-5">
          {/* Media Type Breakdown */}
          {stats.mediaBreakdown && (stats.mediaBreakdown.movie + stats.mediaBreakdown.tv + stats.mediaBreakdown.anime > 0) && (
            <div>
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">Watch Breakdown</h3>
              <div className="space-y-2">
                {(["movie", "tv", "anime"] as const).map(type => {
                  const total = stats.mediaBreakdown.movie + stats.mediaBreakdown.tv + stats.mediaBreakdown.anime || 1;
                  const count = stats.mediaBreakdown[type];
                  const pct = Math.round((count / total) * 100);
                  const labels = { movie: "Movie", tv: "TV Show", anime: "Anime" };
                  const emojis = { movie: "🎬", tv: "📺", anime: "🌸" };
                  const colors = { movie: "bg-[#818cf8]", tv: "bg-[#34d399]", anime: "bg-[#f472b6]" };
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-sm w-8 text-right">{emojis[type]}</span>
                      <span className="text-xs text-text-secondary w-14">{labels[type]}</span>
                      <span className="text-xs font-semibold text-text-primary w-8">{pct}%</span>
                      <div className="flex-1 h-2 bg-bg-surface rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[type]}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Favorites 4 — top rated items */}
          {(() => {
            const favs = library.filter(l => l.rating && l.rating >= 4 && (l as any).mediaType === selectedMediaType).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
            if (favs.length < 2) return null;
            return (
              <div>
                {/* ── AdSense ── */}
                <div className="bg-bg-card border border-dashed border-border rounded-lg flex items-center justify-center mb-3" style={{ minHeight: 64 }}>
                  <div className="text-center">
                    <p className="text-[9px] text-text-secondary uppercase tracking-[0.15em] mb-0.5">Advertisement</p>
                    <p className="text-[10px] text-text-secondary">AdSense · 320×100</p>
                  </div>
                </div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">Favorites</h3>
                <div className="grid grid-cols-4 gap-2">
                  {favs.map((item) => (
                    <a key={item.id} href={`/title/${item.tmdb_id}?type=${item.media_type}`}
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

          {/* ─── Ad Banner ─── */}
          {/* Replace with AdSense/AdMob code when ready */}
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#4c1d95] via-[#7c3aed] to-[#a78bfa] relative">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 right-4 w-14 h-14 rounded-full bg-white/20" />
              <div className="absolute bottom-1 left-8 w-8 h-8 rounded-full bg-white/10" />
              <div className="absolute top-6 left-10 w-3 h-3 rounded-full bg-white/25" />
            </div>
            <div className="relative p-4 flex items-center justify-center text-center min-h-[150px]">
              <div>
                <p className="text-[10px] text-text-primary/50 font-medium uppercase tracking-[0.15em]">Advertisement</p>
                <p className="text-sm font-bold text-text-primary/70 mt-2">AD 300×150</p>
              </div>
            </div>
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

      {/* ── Premium: Genre Taste + Top Actors/Directors ── */}
      {stats && user && (
        <div className="px-4 mt-6 space-y-5">
          {/* Genre Distribution */}
          {stats.genres && stats.genres.length > 0 && (
            <div className="relative">
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">Genre Taste</h3>
              <div className="space-y-1.5">
                {stats.genres.slice(0, 6).map((g, i) => {
                  const maxCount = stats.genres[0]?.count || 1;
                  const pct = Math.round((g.count / maxCount) * 100);
                  return (
                    <div key={g.name} className="flex items-center gap-2">
                      <span className="text-xs text-text-body w-20 truncate">{g.name}</span>
                      <div className="flex-1 h-3 bg-bg-surface rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#818cf8] to-[#a78bfa] rounded-full" style={{ width: `${Math.max(pct, 10)}%` }} />
                      </div>
                      <span className="text-[10px] text-text-muted w-8 text-right">{g.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Actors */}
          {stats.topActors && stats.topActors.length > 0 && (
            <div className="relative">
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">Top Actors</h3>
              <div className="flex flex-wrap gap-2">
                {stats.topActors.slice(0, 5).map((a) => (
                  <span key={a.name} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-body">
                    {a.name} <span className="text-text-muted">{a.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top Directors */}
          {stats.topDirectors && stats.topDirectors.length > 0 && (
            <div className="relative">
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">Top Directors</h3>
              <div className="flex flex-wrap gap-2">
                {stats.topDirectors.slice(0, 5).map((d) => (
                  <span key={d.name} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs text-text-body">
                    {d.name} <span className="text-text-muted">{d.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sign-in prompt for guests */}
      {!user && (
        <div className="px-4 mt-6">
          <a
            href="/login"
            className="block bg-gradient-to-r from-[#4c1d95] via-[#7c3aed] to-[#6366f1] rounded-2xl p-5 text-center hover:shadow-lg hover:shadow-[#7c3aed]/20 transition-shadow"
          >
            <span className="text-3xl block mb-2">🎬</span>
            <h3 className="text-base font-bold text-white mb-1">Join Seriez</h3>
            <p className="text-xs text-white/70 mb-4">
              Track what you watch, discover new favorites, and connect with friends
            </p>
            <span className="inline-block px-6 py-2.5 bg-white text-[#7c3aed] text-sm font-bold rounded-xl hover:bg-white/90 transition-colors">
              Sign In / Sign Up
            </span>
          </a>
        </div>
      )}

      {/* History — only for logged-in users */}
      {user && (
        <div className="mt-6">
          <HistoryClient />
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
