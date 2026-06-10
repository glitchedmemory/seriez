"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileSkeleton } from "@/components/Skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";
import HistoryClient from "@/app/history/HistoryClient";

export const dynamic = "force-dynamic";

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
          <span><strong className="text-white">{followersCount}</strong> followers</span>
          <span><strong className="text-white">{followingCount}</strong> following</span>
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

      {/* History — replaces Activity/취향분석 tabs */}
      <div className="mt-6">
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
