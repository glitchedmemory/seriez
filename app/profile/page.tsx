"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileSkeleton } from "@/components/Skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";
import PosterImage from "@/components/PosterImage";

export const dynamic = "force-dynamic";

interface Activity {
  id: string;
  type: "review" | "rated" | "watched" | "watching" | "plan_to_watch";
  username: string;
  tmdbId: number;
  mediaType: string;
  title: string;
  poster: string | null;
  year: string | null;
  rating?: number;
  content?: string;
  createdAt: string;
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

interface UserStats {
  totals: { watched: number; watching: number; planned: number; rated: number; reviewed: number; hours: number };
  rating: { average: number; mostGiven: number; distribution: { score: number; count: number }[]; personality: string };
  mediaBreakdown: Record<string, number>;
  genres: { name: string; count: number }[];
  tags: string[];
  topActors: { name: string; count: number }[];
  topDirectors: { name: string; count: number }[];
  monthlyWatch: { month: string; count: number }[];
}

const ACTIVITY_LABELS: Record<string, string> = {
  rated: "rated",
  review: "reviewed",
  watched: "watched",
  watching: "started watching",
  plan_to_watch: "plans to watch",
};

const ACTIVITY_ICONS: Record<string, string> = {
  rated: "⭐",
  review: "💬",
  watched: "✅",
  watching: "👀",
  plan_to_watch: "📌",
};

export default function ProfilePage() {
  const [user, setUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState<"activity" | "stats">("activity");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
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
    if (!effectiveUsername) { setStatsLoading(false); return; }
    try {
      const res = await fetch(`/api/library?username=${encodeURIComponent(effectiveUsername)}`).then(r => r.json());
      setLibrary(res.items || []);
    } catch {}
    setStatsLoading(false);
  }, [effectiveUsername]);

  const fetchStats = useCallback(async () => {
    if (!effectiveUsername) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(effectiveUsername)}/stats`).then(r => r.json());
      if (!res.error) setUserStats(res);
    } catch {}
  }, [effectiveUsername]);

  const fetchActivity = useCallback(async () => {
    if (!effectiveUsername) return;
    try {
      const res = await fetch(`/api/activity?username=${encodeURIComponent(effectiveUsername)}`).then(r => r.json());
      setActivities(res.activities || []);
    } catch {
      setActivities([]);
    }
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
      fetchActivity();
      fetchLibrary();
      fetchStats();
    }
  }, [mounted, fetchFollowData, fetchFollowStatus, fetchActivity, fetchLibrary, fetchStats]);

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  }

  if (!mounted) return null;
  if (loading) return <ProfileSkeleton />;

  const displayName = profileUsername || ownUsername || localStorageUsername || "Guest";
  const initial = displayName.slice(0, 1).toUpperCase();

  // Compute stats from library
  const watched = library.filter(i => i.status === "completed");
  const watching = library.filter(i => i.status === "watching");
  const planned = library.filter(i => i.status === "plan_to_watch");
  const rated = library.filter(i => (i.rating ?? 0) > 0);
  const avgRating = rated.length > 0
    ? (rated.reduce((sum, i) => sum + (i.rating ?? 0), 0) / rated.length).toFixed(1)
    : null;

  // Extract genre distribution (we estimate from TMDB genre IDs in the library data)
  // For now show available stats
  const totalItems = library.length;

  return (
    <ErrorBoundary sectionName="Profile">
    <div className="max-w-lg mx-auto pb-32">
      {/* Cover area */}
      <div className="relative h-40 bg-gradient-to-br from-[#6366f1] via-[#7c3aed] to-[#a855f7]">
        {/* Decorative circles */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white" />
          <div className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full bg-white" />
        </div>
      </div>

      {/* Avatar + Info */}
      <div className="relative px-4 -mt-10">
        <div className="flex items-end gap-4 mb-4">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0 ring-4 ring-[#0f0f1a] shadow-xl">
            <span className="text-3xl font-bold text-white">{initial}</span>
          </div>
          {/* Follow button (own profile: edit / other: follow) */}
          <div className="flex-1" />
          {!isOwn && user ? (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all mb-1 ${
                isFollowing
                  ? "bg-[#1a1a2e] border border-[#2d2d4a] text-[#9ca3af] hover:text-red-400 hover:border-red-500"
                  : "bg-[#6366f1] text-white hover:bg-[#818cf8] shadow-lg shadow-[#6366f1]/25"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          ) : !isOwn && !user ? (
            <a
              href="/login"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#6366f1] text-white hover:bg-[#818cf8] shadow-lg shadow-[#6366f1]/25 transition-colors mb-1"
            >
              Follow
            </a>
          ) : null}
        </div>

        {/* Name & Stats */}
        <h1 className="text-2xl font-bold text-white">@{displayName}</h1>
        <div className="flex gap-5 mt-1 text-sm text-[#9ca3af]">
          <span><strong className="text-white">{followersCount}</strong> followers</span>
          <span><strong className="text-white">{followingCount}</strong> following</span>
        </div>

        {/* Quick Stats Bar */}
        {!statsLoading && totalItems > 0 && (
          <div className="flex gap-4 mt-4 p-3 bg-[#1a1a2e]/80 border border-[#2d2d4a] rounded-xl">
            <StatBadge value={watched.length} label="Watched" color="text-emerald-400" />
            <StatBadge value={watching.length} label="Watching" color="text-sky-400" />
            <StatBadge value={planned.length} label="Plan to Watch" color="text-amber-400" />
            {avgRating && <StatBadge value={avgRating} label="Avg Rating" color="text-yellow-400" prefix="★ " />}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mt-6 border-b border-[#1a1a2e] px-4">
        <button
          onClick={() => setActiveTab("activity")}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "activity" ? "border-[#6366f1] text-white" : "border-transparent text-[#6b7280] hover:text-[#9ca3af]"
          }`}
        >
          Activity
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "stats" ? "border-[#6366f1] text-white" : "border-transparent text-[#6b7280] hover:text-[#9ca3af]"
          }`}
        >
          취향분석
        </button>
      </div>

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <div className="px-4 mt-4 space-y-3">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-[#1a1a2e] flex items-center justify-center mb-4">
                <span className="text-3xl">👥</span>
              </div>
              <p className="text-white font-semibold mb-1">
                {isOwn ? "No activity yet" : `@${displayName} hasn't done anything yet`}
              </p>
              <p className="text-sm text-[#6b7280] max-w-xs">
                {isOwn
                  ? "Follow other users and rate titles to build your activity feed"
                  : "Check back later"}
              </p>
            </div>
          ) : (
            activities.map((a) => (
              <a
                key={a.id}
                href={`/title/${a.tmdbId}`}
                className="flex gap-3 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 hover:border-[#6366f1]/50 hover:bg-[#1e1e35] transition-all group"
              >
                <div className="flex-shrink-0 w-10 h-[60px] rounded-lg overflow-hidden bg-[#0f0f1a] relative">
                  <PosterImage src={a.poster} alt="" fill className="rounded-lg" sizes="40px" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{ACTIVITY_ICONS[a.type] || "•"}</span>
                    <p className="text-sm text-white truncate">
                      <span className="text-[#6366f1] font-medium group-hover:text-[#818cf8]">@{a.username}</span>
                      {" "}<span className="text-[#9ca3af]">{ACTIVITY_LABELS[a.type] || a.type}</span>{" "}
                      <span className="text-white font-medium">{a.title}</span>
                    </p>
                  </div>
                  {a.rating && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-[#f59e0b]">★ {a.rating}</span>
                    </div>
                  )}
                  {a.content && (
                    <p className="text-xs text-[#9ca3af] mt-1 line-clamp-2 leading-relaxed italic">
                      &ldquo;{a.content}&rdquo;
                    </p>
                  )}
                  <p className="text-[10px] text-[#6b7280] mt-1">
                    {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </a>
            ))
          )}
        </div>
      )}

      {/* Stats / Taste Analysis Tab */}
      {activeTab === "stats" && (
        <div className="px-4 mt-4 pb-8">
          {!userStats ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#1a1a2e] flex items-center justify-center mb-3">
                <span className="text-2xl">📊</span>
              </div>
              <p className="text-[#9ca3af] text-sm">Loading taste analysis…</p>
            </div>
          ) : userStats.totals.rated === 0 && userStats.totals.watched === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-[#1a1a2e] flex items-center justify-center mb-4">
                <span className="text-3xl">🎬</span>
              </div>
              <p className="text-white font-semibold mb-1">No data yet</p>
              <p className="text-sm text-[#6b7280] max-w-xs">
                Rate and track titles to unlock your taste analysis
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Personality + Rating Distribution */}
              <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
                <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-2">별점 분포</h3>
                <p className="text-[#818cf8] text-sm mb-4">{userStats.rating.personality}</p>
                
                {/* Rating bars */}
                <div className="space-y-1.5 mb-4">
                  {[...userStats.rating.distribution].reverse().map(({ score, count }) => {
                    const maxCount = Math.max(...userStats.rating.distribution.map(d => d.count), 1);
                    const width = (count / maxCount) * 100;
                    const isHighest = score === userStats.rating.mostGiven;
                    return (
                      <div key={score} className="flex items-center gap-2">
                        <span className="w-6 text-right text-xs text-[#6b7280]">{score.toFixed(1)}</span>
                        <div className="flex-1 h-3 bg-[#0f0f1a] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isHighest ? "bg-[#818cf8]" : "bg-[#818cf8]/30"}`}
                            style={{ width: `${Math.max(width, 2)}%` }}
                          />
                        </div>
                        <span className="w-6 text-xs text-[#6b7280]">{count}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Rating summary */}
                <div className="flex gap-4 text-center">
                  <div className="flex-1">
                    <p className="text-xl font-bold text-white">{userStats.rating.average || "—"}</p>
                    <p className="text-[10px] text-[#6b7280]">별점 평균</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xl font-bold text-white">{userStats.totals.rated}</p>
                    <p className="text-[10px] text-[#6b7280]">별점 개수</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xl font-bold text-white">{userStats.rating.mostGiven}</p>
                    <p className="text-[10px] text-[#6b7280]">많이 준 별점</p>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="flex gap-3">
                <StatCard icon="✅" value={userStats.totals.watched} label="시청 완료" color="text-emerald-400" />
                <StatCard icon="👀" value={userStats.totals.watching} label="시청 중" color="text-sky-400" />
                <StatCard icon="📌" value={userStats.totals.planned} label="볼 예정" color="text-amber-400" />
              </div>

              {/* Watch time */}
              {userStats.totals.hours > 0 && (
                <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
                  <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-2">감상 시간</h3>
                  <p className="text-3xl font-bold text-[#818cf8]">{userStats.totals.hours.toLocaleString()} 시간</p>
                </div>
              )}

              {/* Tags */}
              {userStats.tags.length > 0 && (
                <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
                  <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-3">선호 태그</h3>
                  <div className="flex flex-wrap gap-2">
                    {userStats.tags.map((tag, i) => {
                      const sizes = ["text-sm px-4 py-2", "text-base px-5 py-2.5", "text-lg px-6 py-3", "text-xs px-3 py-1.5"];
                      const size = sizes[i % 4];
                      return (
                        <span key={tag} className={`${size} rounded-full bg-[#818cf8]/10 text-[#818cf8] border border-[#818cf8]/20 font-medium`}>
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Genre Distribution */}
              {userStats.genres.length > 0 && (
                <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
                  <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-3">선호 장르</h3>
                  <div className="space-y-2">
                    {userStats.genres.slice(0, 8).map((genre) => (
                      <div key={genre.name} className="flex items-center gap-2">
                        <span className="w-16 text-xs text-[#9ca3af]">{genre.name}</span>
                        <div className="flex-1 h-4 bg-[#0f0f1a] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] rounded-full"
                            style={{ width: `${Math.max((genre.count / userStats.genres[0].count) * 100, 5)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs text-[#6b7280]">{genre.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Actors */}
              {userStats.topActors.length > 0 && (
                <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
                  <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-3">선호 배우</h3>
                  <div className="space-y-3">
                    {userStats.topActors.slice(0, 5).map((actor, i) => (
                      <div key={actor.name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-[#818cf8]">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{actor.name}</p>
                          <p className="text-[10px] text-[#6b7280]">{actor.count}편 출연</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Directors */}
              {userStats.topDirectors.length > 0 && (
                <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
                  <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-3">선호 감독</h3>
                  <div className="space-y-3">
                    {userStats.topDirectors.slice(0, 5).map((director, i) => (
                      <div key={director.name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#7c3aed]/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-[#a78bfa]">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{director.name}</p>
                          <p className="text-[10px] text-[#6b7280]">{director.count}편 연출</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Media breakdown */}
              <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
                <h3 className="text-[#9ca3af] text-xs font-semibold uppercase tracking-wide mb-3">미디어 분포</h3>
                <div className="flex gap-2">
                  <MediaTypeBadge label="🎬 Movies" count={userStats.mediaBreakdown.movie || 0} color="#6366f1" />
                  <MediaTypeBadge label="📺 TV" count={userStats.mediaBreakdown.tv || 0} color="#7c3aed" />
                  <MediaTypeBadge label="🎌 Anime" count={userStats.mediaBreakdown.anime || 0} color="#f59e0b" />
                </div>
              </div>

              {/* Sign out */}
              {isOwn && user && (
                <button
                  onClick={handleSignOut}
                  className="w-full mt-6 py-3 rounded-xl bg-[#1a1a2e] border border-[#2d2d4a] text-[#6b7280] text-sm hover:text-red-400 hover:border-red-500/50 transition-colors"
                >
                  Sign out
                </button>
              )}
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
      <p className="text-[10px] text-[#6b7280] uppercase tracking-wide">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#9ca3af] mb-2">{title}</h3>
      {children}
    </div>
  );
}

function LibraryRow({ item }: { item: LibraryItem }) {
  return (
    <a
      href={`/title/${item.tmdb_id}`}
      className="flex items-center gap-3 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-2.5 hover:border-[#6366f1]/50 transition-colors group"
    >
      <div className="flex-shrink-0 w-10 h-[60px] rounded-lg overflow-hidden bg-[#0f0f1a] relative">
        <PosterImage src={item.poster} alt="" fill className="rounded-lg" sizes="40px" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate group-hover:text-[#6366f1] transition-colors">
          {item.title}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-[#6b7280]">
          {item.year && <span>{item.year}</span>}
          <span className="uppercase">{item.media_type}</span>
        </div>
      </div>
      {item.rating && (
        <span className="text-xs text-[#f59e0b] font-medium flex-shrink-0">★ {item.rating}</span>
      )}
    </a>
  );
}

function StatCard({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <div className="flex-1 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 text-center">
      <span className="text-lg">{icon}</span>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-[#6b7280]">{label}</p>
    </div>
  );
}

function MediaTypeBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex-1 bg-[#0f0f1a] rounded-xl p-3 text-center">
      <p className="text-xs text-[#9ca3af]">{label}</p>
      <p className="text-lg font-bold mt-1" style={{ color }}>{count}</p>
    </div>
  );
}
