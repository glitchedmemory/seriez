"use client";

import { useState, useEffect, Fragment } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import PosterImage from "@/components/PosterImage";
import PollCard from "@/components/PollCard";
import { titleHref } from "@/lib/title-utils";

interface Activity {
  id: string;
  type: "review" | "rated" | "watched" | "watching" | "plan_to_watch" | "collection" | "released" | "like" | "comment";
  username: string;
  tmdbId: number;
  mediaType: string;
  title: string;
  poster: string | null;
  year: string | null;
  season?: number | null;
  rating?: number;
  content?: string;
  collectionName?: string;
  itemCount?: number;
  reviewId?: string | null;
  notifRead?: boolean;
  createdAt: string;
}

function getTypeConfig(t: any) {
  return {
    review:      { emoji: "📝", text: t("feedPage.reviewed"),         badge: t("feedPage.badgeReview"),   color: "#a855f7", badgeClass: "bg-accent-light/15 text-[#c084fc]" },
    rated:       { emoji: "⭐", text: t("feedPage.rated"),             badge: t("feedPage.badgeRated"),    color: "#f59e0b", badgeClass: "bg-gold/15 text-[#fbbf24]" },
    watched:     { emoji: "✅", text: t("feedPage.watched"),            badge: t("feedPage.badgeWatched"),  color: "#22c55e", badgeClass: "bg-[#22c55e]/15 text-[#4ade80]" },
    watching:    { emoji: "👁️", text: t("feedPage.isWatching"),       badge: t("feedPage.badgeWatching"), color: "#3b82f6", badgeClass: "bg-[#3b82f6]/15 text-[#60a5fa]" },
    plan_to_watch:{ emoji: "📌", text: t("feedPage.plansToWatch"),  badge: t("feedPage.badgePlan"),     color: "#6b7280", badgeClass: "bg-[#6b7280]/15 text-text-secondary" },
    released:    { emoji: "🎬", text: t("feedPage.released"),          badge: t("feedPage.badgeReleased"), color: "#22c55e", badgeClass: "bg-[#22c55e]/15 text-[#4ade80]" },
    collection:  { emoji: "📁", text: t("feedPage.publishedCollection"), badge: "", color: "#ec4899", badgeClass: "" },
    like:        { emoji: "❤️", text: t("feedPage.likedReview"),       badge: "", color: "#ec4899", badgeClass: "" },
    comment:     { emoji: "💬", text: t("feedPage.commentedOnReview"), badge: "", color: "#3b82f6", badgeClass: "" },
  } as Record<string, { emoji: string; text: string; badge: string; color: string; badgeClass: string }>;
}

function timeAgo(dateStr: string, now: number, t: any): string {
  const diff = now - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return t("feedPage.minAgo").replace("{n}", String(min));
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("feedPage.hourAgo").replace("{n}", String(hr));
  const days = Math.floor(hr / 24);
  if (days < 7) return t("feedPage.dayAgo").replace("{n}", String(days));
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
  const t = useTranslations();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setActivities(data.activities || []);
      })
      .catch(() => setError(t("streaming.failedToLoad")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-bg-primary/95 backdrop-blur-md px-4 py-3 border-b border-border">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
          {t("feed.title")}
        </h1>
      </header>

      {/* Poll — active 투표 캠페인 (최상단 고정) */}
      <PollCard />

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
          <h2 className="text-text-primary text-lg font-bold mb-2">{t("feedPage.noActivity")}</h2>
          <p className="text-text-secondary text-sm">
            {t("feedPage.noActivityDesc")}
          </p>
        </div>
      ) : (
        <>
          {/* Activity 섹션 헤딩 */}
          <div className="flex items-center gap-2 px-4 pt-6 pb-2.5 md:px-0">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-text-secondary">
              {t("feedPage.activitySection") || "Activity"}
            </span>
          </div>
          <div className="px-4 md:px-0">
          {activities.map((a, idx) => {
            const typeConfig = getTypeConfig(t);
            const cfg = typeConfig[a.type] || typeConfig.plan_to_watch;
            const isCollection = a.type === "collection";
            const hasReview = a.type === "review" && a.content;
            const isNotif = a.type === "like" || a.type === "comment";
            const baseHref = isCollection
              ? `/collections/${a.id.replace("col-", "").replace("v-", "")}`
              : titleHref(a.tmdbId, a.mediaType, a.season);
            // like/comment notifications jump to the work page AND scroll to the
            // specific review via the ?review= anchor.
            const href = isNotif && a.reviewId
              ? `${baseHref}?review=${encodeURIComponent(a.reviewId)}`
              : baseHref;

            return (
              <Fragment key={a.id}>
                <Link
              key={a.id}
              href={href}
              className={`flex items-start gap-3 px-4 py-3.5 hover:bg-bg-primary transition-colors group relative ${idx < activities.length - 1 || idx === 2 ? "border-b border-border/50" : ""}`}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: cfg.color }}
              >
                <span className="text-xs font-bold text-white">
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
                    {isCollection ? a.collectionName : (a.type === "released" && a.season ? `${a.title} S${a.season}` : a.title)}
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
                      📁 {a.itemCount} {a.itemCount !== 1 ? t("feedPage.items") : t("feedPage.item")}
                    </span>
                  )}
                  <span className="text-[11px] text-text-secondary">{timeAgo(a.createdAt, now, t)}</span>
                </div>

                {/* Review snippet */}
                {hasReview && (
                  <div className="mt-2 text-[12px] text-text-secondary leading-relaxed italic bg-bg-surface rounded-xl px-3 py-2.5">
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

              </Fragment>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}
