"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileSkeleton } from "@/components/Skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";
import HistoryClient from "@/app/history/HistoryClient";
import { useState, useEffect, useCallback } from "react";

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
  const [followLoading, setFollowLoading] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [showFollowers, setShowFollowers] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<any[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const profileUsername = searchParams.get("username");
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
      const res = await fetch(`/api/follow?target=${encodeURIComponent(profileUsername)}`).then(r => r.json());
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
    if (!effectiveUsername || isOwn) { setCompareData(null); return; }
    setCompareLoading(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(effectiveUsername)}/compare`).then(r => r.json());
      if (!res.error) setCompareData(res);
    } catch {}
    setCompareLoading(false);
  }, [effectiveUsername, isOwn]);

  const fetchFollowList = useCallback(async (type: "followers" | "following") => {
    if (!effectiveUsername) return;
    try {
      const res = await fetch(`/api/follow?username=${encodeURIComponent(effectiveUsername)}&type=${type}&detail=true`).then(r => r.json());
      setFollowList(res.users || []);
      setShowFollowers(type);
    } catch {}
  }, [effectiveUsername]);

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
    setFollowLoading(true);
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
    setFollowLoading(false);
  }

  if (!mounted) return null;
  if (loading) return <ProfileSkeleton />;

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
            <button onClick={handleFollow} disabled={followLoading}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all mb-1 ${
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
          {/* Match Rate */}
          <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5 text-center">
            <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-2">취향매칭률</h3>
            <p className="text-4xl font-bold text-[#818cf8]">{compareData.matchRate}%</p>
          </div>

          {/* Both Enjoyed */}
          {compareData.bothEnjoyed.length > 0 && (
            <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
              <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-3">둘 다 재밌게 본 작품</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {compareData.bothEnjoyed.map((item, i) => (
                  <a key={i} href={`/title/${item.tmdbId}?type=${item.mediaType}`}
                    className="flex-shrink-0 w-24 text-center">
                    <div className="w-24 h-36 rounded-lg overflow-hidden bg-[#0f0f1a] mb-1">
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">🎬</div>
                      )}
                    </div>
                    <p className="text-[10px] text-white truncate">{item.title}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Divergent Ratings */}
          {compareData.divergent.length > 0 && (
            <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
              <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-3">서로 평가가 엇갈린 작품</h3>
              <div className="space-y-3">
                {compareData.divergent.map((item, i) => (
                  <a key={i} href={`/title/${item.tmdbId}?type=${item.mediaType}`}
                    className="flex gap-3 items-center hover:bg-[#25253a] rounded-lg p-1 -m-1 transition-colors">
                    <div className="w-12 h-16 rounded-lg overflow-hidden bg-[#0f0f1a] flex-shrink-0">
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">🎬</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{item.title}</p>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-[10px] text-[#818cf8]">내 평가 ★{item.myRating}</span>
                        <span className="text-[10px] text-[#f59e0b]">상대 평가 ★{item.theirRating}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Followers/Following List */}
      {showFollowers && (
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">
              {showFollowers === "followers" ? "Followers" : "Following"}
            </h3>
            <button onClick={() => setShowFollowers(null)} className="text-xs text-[#6b7280] hover:text-white">✕ Close</button>
          </div>
          <div className="space-y-2">
            {followList.map((u: any) => (
              <a key={u.username} href={`/profile?username=${encodeURIComponent(u.username)}`}
                className="flex items-center gap-3 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 hover:border-[#6366f1]/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white">{u.username[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{u.username}</p>
                  <p className="text-[10px] text-[#6b7280]">
                    평가 {u.ratingsCount || 0} · 코멘트 {u.commentsCount || 0}
                  </p>
                </div>
                {!u.isFollowing && u.username !== ownUsername && (
                  <button onClick={(e) => { e.preventDefault(); fetch(`/api/follow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ followingUsername: u.username }) }); }}
                    className="px-3 py-1 bg-[#6366f1] hover:bg-[#818cf8] text-white text-xs rounded-lg transition-colors">
                    팔로우
                  </button>
                )}
              </a>
            ))}
          </div>
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
