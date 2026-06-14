"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PosterImage from "@/components/PosterImage";

interface Activity {
  id: string;
  type: "review" | "rated" | "watched" | "watching" | "plan_to_watch" | "collection";
  username: string;
  tmdbId: number;
  mediaType: string;
  title: string;
  poster: string | null;
  year: string | null;
  rating?: number;
  content?: string;
  collectionName?: string;
  itemCount?: number;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { emoji: string; text: string; badge: string; color: string; badgeClass: string }> = {
  review:      { emoji: "📝", text: "reviewed",         badge: "REVIEW",   color: "#a855f7", badgeClass: "bg-accent-light/15 text-[#c084fc]" },
  rated:       { emoji: "⭐", text: "rated",             badge: "RATED",    color: "#f59e0b", badgeClass: "bg-gold/15 text-[#fbbf24]" },
  watched:     { emoji: "✅", text: "watched",            badge: "WATCHED",  color: "#22c55e", badgeClass: "bg-[#22c55e]/15 text-[#4ade80]" },
  watching:    { emoji: "👁️", text: "is watching",       badge: "WATCHING", color: "#3b82f6", badgeClass: "bg-[#3b82f6]/15 text-[#60a5fa]" },
  plan_to_watch:{ emoji: "📌", text: "plans to watch",  badge: "PLAN",     color: "#6b7280", badgeClass: "bg-[#6b7280]/15 text-text-secondary" },
  collection:  { emoji: "📁", text: "published a collection", badge: "", color: "#ec4899", badgeClass: "" },
};

const AVATAR_COLORS = [
  "from-[#7c3aed] to-[#a855f7]",
  "from-[#ea580c] to-[#f59e0b]",
  "from-[#059669] to-[#22c55e]",
  "from-[#2563eb] to-[#6366f1]",
  "from-[#db2777] to-[#ec4899]",
  "from-[#0891b2] to-[#06b6d4]",
];

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const stars = [];
  for (let i = 0; i < 5; i++) {
    if (i < full) stars.push("★");
    else if (i === full && half) stars.push("★");
    else stars.push("☆");
  }
  return <span className="text-gold text-[13px] tracking-tight">{stars.join(" ")}</span>;
}

export default function FeedPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setActivities(data.activities || []);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-lg md:max-w-2xl mx-auto min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-bg-primary/95 backdrop-blur-md px-4 py-3 border-b border-border">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
          Feed
        </h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="px-4 mt-10 text-center">
          <span className="text-4xl mb-3 block">📭</span>
          <p className="text-text-secondary text-sm">{error}</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="px-4 mt-10 text-center">
          <span className="text-4xl mb-3 block">🔔</span>
          <h2 className="text-text-primary text-lg font-bold mb-2">No activity yet</h2>
          <p className="text-text-secondary text-sm">
            Follow other users to see their activity here.
          </p>
        </div>
      ) : (
        <div className="">
          {activities.map((a, idx) => {
            const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.plan_to_watch;
            const isCollection = a.type === "collection";
            const hasReview = a.type === "review" && a.content;
            const href = isCollection
              ? `/collections/${a.id.replace("col-", "").replace("v-", "")}`
              : `/title/${a.tmdbId}?type=${a.mediaType}`;
            const avatarGradient = getAvatarColor(a.username);

            return (
            <Link
              key={a.id}
              href={href}
              className={`flex items-start gap-3 px-4 py-3.5 hover:bg-bg-primary transition-colors group relative ${idx < activities.length - 1 ? "border-b border-dotted border-border/50" : ""}`}
            >
              {/* Left color bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r"
                style={{ backgroundColor: cfg.color }}
              />

              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center flex-shrink-0 mt-0.5`}
              >
                <span className="text-xs font-bold text-text-primary">
                  {a.username.slice(0, 1).toUpperCase()}
                </span>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                {/* Top row: username + action + title + badge */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[13px] font-bold text-accent-light">{a.username}</span>
                  <span className="text-[13px] text-text-secondary">{cfg.text}</span>
                  <span className="text-[13px] font-semibold text-text-primary group-hover:text-accent transition-colors truncate max-w-[200px]">
                    {isCollection ? a.collectionName : a.title}
                  </span>
                  {cfg.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cfg.badgeClass}`}>
                      {cfg.badge}
                    </span>
                  )}
                </div>

                {/* Meta row: stars + year + time */}
                <div className="flex items-center gap-2 mt-1">
                  {a.rating && a.rating > 0 && !isCollection && (
                    <RatingStars rating={a.rating} />
                  )}
                  {!isCollection && a.year && (
                    <span className="text-[11px] text-text-secondary">{a.year}</span>
                  )}
                  {isCollection && a.itemCount !== undefined && (
                    <span className="text-[11px] text-[#ec4899]">
                      📁 {a.itemCount} item{a.itemCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="text-[11px] text-text-secondary">{timeAgo(a.createdAt)}</span>
                </div>

                {/* Review snippet */}
                {hasReview && (
                  <div className="mt-2 text-[11px] text-text-secondary leading-relaxed italic bg-bg-surface border-l-2 border-[#a855f7] rounded-r-md px-2.5 py-2">
                    &ldquo;{a.content}&rdquo;
                  </div>
                )}
              </div>

              {/* Poster or collection icon */}
              {isCollection ? (
                <div className="w-10 h-[56px] rounded-lg bg-bg-card flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📁</span>
                </div>
              ) : (
                <div className="w-10 h-[56px] rounded-lg overflow-hidden bg-bg-card flex-shrink-0 relative">
                  {a.poster ? (
                    <PosterImage src={a.poster} alt="" fill className="rounded-lg" sizes="40px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-primary/10 text-lg font-bold">
                      {a.title.slice(0, 1)}
                    </div>
                  )}
                </div>
              )}
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
