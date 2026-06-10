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
    }
  }, [mounted, fetchFollowData, fetchFollowStatus, fetchLibrary]);

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

  if (!mounted) return null;
  if (loading) return <ProfileSkeleton />;

  // ── Tab page: Followers / Following ──
  if (tab === "followers" || tab === "following") {
    const tabLabel = tab === "followers" ? "Followers" : "Following";
    return (
      <ErrorBoundary sectionName={`Profile ${tabLabel}`}>
        <div className="max-w-lg mx-auto pb-32">
          {/* Header */}
          <div className="flex items-center gap-4 px-4 pt-4 pb-3">
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("tab");
                router.push(`/profile?${params.toString()}`);
              }}
              className="text-[#9ca3af] hover:text-white transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-lg font-bold text-white">
              {effectiveUsername ? `@${effectiveUsername}` : ""} · {tabLabel}
            </h1>
          </div>

          {/* List */}
          <div className="px-4">
            {followListLoading ? (
              <div className="space-y-3 mt-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#2d2d4a]" />
                      <div className="flex-1">
                        <div className="h-4 w-24 bg-[#2d2d4a] rounded mb-2" />
                        <div className="h-3 w-32 bg-[#2d2d4a] rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : followList.length === 0 ? (
              <p className="text-center text-[#6b7280] py-12">
                {tab === "followers" ? "No followers yet" : "Not following anyone yet"}
              </p>
            ) : (
              <div className="space-y-2 mt-2">
                {followList.map((u: any) => (
                  <a
                    key={u.username}
                    href={`/profile?username=${encodeURIComponent(u.username)}`}
                    className="flex items-center gap-3 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 hover:border-[#6366f1]/50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0">
                      <span className="text-base font-bold text-white">
                        {u.username[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">@{u.username}</p>
                      <p className="text-[10px] text-[#6b7280]">
                        평가 {u.ratingsCount || 0} · 코멘트 {u.commentsCount || 0}
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
                        className="px-3 py-1.5 bg-[#6366f1] hover:bg-[#818cf8] text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        팔로우
                      </button>
                    )}
                    {u.isFollowing && u.username !== ownUsername && (
                      <span className="text-[10px] text-[#6b7280] px-2">팔로잉</span>
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

  const watched = library.filter(i => i.status === "completed");
  const watching = library.filter(i => i.status === "watching");
  const planned = library.filter(i => i.status === "plan_to_watch");
  const rated = library.filter(i => (i.rating ?? 0) > 0);
  const avgRating = rated.length > 0
    ? (rated.reduce((sum, i) => sum + (i.rating ?? 0), 0) / rated.length).toFixed(1)
    : null;
  const totalItems = library.length;

  return (
    <ErrorBoundary sectionName="Profile">
    <div className="max-w-lg mx-auto pb-32">
      {/* Cover area */}
      <div className="relative h-40 bg-gradient-to-br from-[#6366f1] via-[#7c3aed] to-[#a855f7]">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white" />
          <div className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full bg-white" />
        </div>
      </div>

      {/* Avatar + Info */}
      <div className="relative px-4 -mt-10">
        <div className="flex items-end gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0 ring-4 ring-[#0f0f1a] shadow-xl">
            <span className="text-3xl font-bold text-white">{initial}</span>
          </div>
          <div className="flex-1" />
          {!isOwn && user ? (
            <button onClick={handleFollow}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 mb-1 ${
                bounce ? "scale-110" : "scale-100"
              } ${
                isFollowing
                  ? "bg-[#1a1a2e] border border-[#2d2d4a] text-[#9ca3af] hover:text-red-400 hover:border-red-500"
                  : "bg-[#6366f1] text-white hover:bg-[#818cf8] shadow-lg shadow-[#6366f1]/25"
              }`}>
              {isFollowing ? "Following" : "Follow"}
            </button>
          ) : !isOwn && !user ? (
            <a href="/login"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#6366f1] text-white hover:bg-[#818cf8] shadow-lg shadow-[#6366f1]/25 transition-colors mb-1">
              Follow
            </a>
          ) : null}
        </div>

        <h1 className="text-2xl font-bold text-white">@{displayName}</h1>
        <div className="flex gap-5 mt-1 text-sm text-[#9ca3af]">
          <button onClick={() => fetchFollowList("followers")} className="hover:text-white transition-colors">
            <strong className="text-white">{followersCount}</strong> followers
          </button>
          <button onClick={() => fetchFollowList("following")} className="hover:text-white transition-colors">
            <strong className="text-white">{followingCount}</strong> following
          </button>
        </div>

        {totalItems > 0 && (
          <div className="flex gap-4 mt-4 p-3 bg-[#1a1a2e]/80 border border-[#2d2d4a] rounded-xl">
            <StatBadge value={watched.length} label="Watched" color="text-emerald-400" />
            <StatBadge value={watching.length} label="Watching" color="text-sky-400" />
            <StatBadge value={planned.length} label="Plan to Watch" color="text-amber-400" />
            {avgRating && <StatBadge value={avgRating} label="Avg Rating" color="text-yellow-400" prefix="★ " />}
          </div>
        )}
      </div>

      {/* Taste Comparison — only on other users' profiles */}
      {!isOwn && user && compareData && !compareLoading && (
        <div className="px-4 mt-6 space-y-4">
          {/* Match Rate — compact banner style */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#818cf8] to-[#a78bfa] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs">♡</span>
            </div>
            <span className="text-sm text-[#9ca3af]">취향매칭률</span>
            <span className="text-2xl font-bold text-white ml-auto">{compareData.matchRate}%</span>
          </div>

          {/* Promo Banner */}
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#4c1d95] via-[#7c3aed] to-[#a78bfa] relative">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 right-4 w-16 h-16 rounded-full bg-white/20" />
              <div className="absolute bottom-1 left-8 w-10 h-10 rounded-full bg-white/10" />
              <div className="absolute top-8 left-12 w-3 h-3 rounded-full bg-white/30" />
            </div>
            <div className="relative px-4 py-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Seriez Premium</p>
                <p className="text-sm font-bold text-white mt-0.5">취향이 통하는 친구와</p>
                <p className="text-sm font-bold text-amber-300">함께 감상해보세요</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className="text-white/80 text-[10px] line-through block">$3.99</span>
                <span className="text-amber-300 font-bold text-sm">무료체험</span>
              </div>
            </div>
          </div>

          {/* ─── AdSense placeholder ─── */}
          {/* Replace the div below with your AdSense code when ready */}
          <div className="rounded-xl bg-[#1a1a2e] border border-dashed border-[#2d2d4a] p-3 text-center">
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wider">Advertisement</p>
            <div className="h-[100px] flex items-center justify-center text-[#2d2d4a] text-xs mt-1">
              Ad Banner 320×100
            </div>
          </div>

          {/* Both Enjoyed */}
          {compareData.bothEnjoyed.length > 0 && (
            <div>
              <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-2 px-1">Both Enjoyed</h3>
              <div className="space-y-2">
                {compareData.bothEnjoyed.slice(0, 3).map((item, i) => (
                  <a key={i} href={`/title/${item.tmdbId}?type=${item.mediaType}`}
                    className="flex items-center gap-3 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 hover:border-[#6366f1]/40 transition-colors">
                    <div className="w-14 h-[84px] rounded-lg overflow-hidden bg-[#0f0f1a] flex-shrink-0">
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/15 text-lg">🎬</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{item.title}</p>
                      {item.year && <p className="text-[11px] text-[#6b7280] mt-0.5">{item.year}</p>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Ratings Apart */}
          {compareData.divergent.length > 0 && (
            <div>
              <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-2 px-1">Ratings Apart</h3>
              <div className="space-y-2">
                {compareData.divergent.slice(0, 3).map((item, i) => (
                  <a key={i} href={`/title/${item.tmdbId}?type=${item.mediaType}`}
                    className="flex items-center gap-3 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 hover:border-[#6366f1]/40 transition-colors">
                    <div className="w-14 h-[84px] rounded-lg overflow-hidden bg-[#0f0f1a] flex-shrink-0">
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/15 text-lg">🎬</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-4 mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[#6b7280] w-8">You</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-semibold text-[#818cf8]">{item.myRating}</span>
                            <span className="text-[10px] text-[#818cf8]/60">★</span>
                          </div>
                        </div>
                        <div className="w-px h-4 bg-[#2d2d4a]" />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[#6b7280] w-8">Them</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-semibold text-[#f59e0b]">{item.theirRating}</span>
                            <span className="text-[10px] text-[#f59e0b]/60">★</span>
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

      {/* History — replaces Activity/취향분석 tabs */}
      <div className={!isOwn && compareData ? "mt-6" : "mt-6"}>
        <HistoryClient />
      </div>
    </div>
    </ErrorBoundary>
  );
}

function StatBadge({ value, label, color, prefix = "" }: { value: string | number; label: string; color: string; prefix?: string }) {
  return (
    <div className="flex-1 text-center">
      <p className={`text-lg font-bold ${color}`}>{prefix}{value}</p>
      <p className="text-[10px] text-[#6b7280] uppercase tracking-wide">{label}</p>
    </div>
  );
}
