"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

function formatDate(iso: string) {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/* ── Render 5 stars with half‑star support (linear‑gradient) ── */
function renderStars(rating: number) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fill = rating >= i ? 100 : rating >= i - 0.5 ? 50 : 0;
    if (fill === 100) {
      stars.push(
        <span key={i} style={{ color: "#f59e0b", fontSize: 14 }}>★</span>
      );
    } else if (fill === 50) {
      stars.push(
        <span
          key={i}
          style={{
            fontSize: 14,
            backgroundImage: "linear-gradient(to right, #f59e0b 50%, #4b5563 50%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          ★
        </span>
      );
    } else {
      stars.push(
        <span key={i} style={{ color: "#4b5563", fontSize: 14 }}>★</span>
      );
    }
  }
  return <span className="inline-flex gap-px">{stars}</span>;
}

interface Review {
  id: string;
  username: string;
  content: string;
  rating: number;
  likes: number;
  liked: boolean;
  createdAt: string;
}

interface RatingStatsData {
  average: number;
  total: number;
  distribution: Record<number, number>;
}

export function ReviewSection({
  tmdbId,
  mediaType,
  trackStatus,
  trackVersion = 0,
}: {
  tmdbId: number;
  mediaType: string;
  trackStatus?: string | null;
  trackVersion?: number;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<RatingStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [content, setContent] = useState("");
  const [authUser, setAuthUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const supabase = createClient();

  // ── Comment state ──
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());

  const toggleComments = async (reviewId: string, reviewAuthor: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId);
    } else {
      newExpanded.add(reviewId);
      // Fetch comments if not already loaded
      if (!comments[reviewId]) {
        setLoadingComments((prev) => new Set(prev).add(reviewId));
        try {
          const res = await fetch(`/api/review-comments?review_id=${reviewId}`);
          if (res.ok) {
            const data = await res.json();
            setComments((prev) => ({ ...prev, [reviewId]: data }));
          }
        } catch {}
        setLoadingComments((prev) => {
          const next = new Set(prev);
          next.delete(reviewId);
          return next;
        });
      }
    }
    setExpandedComments(newExpanded);
  };

  const submitComment = async (reviewId: string, reviewAuthor: string, reviewTmdbId: number, titleName: string) => {
    const text = commentInputs[reviewId]?.trim();
    if (!text || !authUser) return;

    const optimisticComment = {
      id: "optimistic-" + Date.now(),
      username: authUser.user_metadata?.username || authUser.email?.split("@")[0] || "User",
      content: text,
      created_at: new Date().toISOString(),
    };

    setComments((prev) => ({
      ...prev,
      [reviewId]: [...(prev[reviewId] || []), optimisticComment],
    }));
    setCommentInputs((prev) => ({ ...prev, [reviewId]: "" }));

    try {
      const res = await fetch("/api/review-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: reviewId,
          content: text,
          tmdb_id: reviewTmdbId,
          title_name: titleName,
          review_author: reviewAuthor,
        }),
      });
      if (res.ok) {
        // Refresh comments
        const refresh = await fetch(`/api/review-comments?review_id=${reviewId}`);
        if (refresh.ok) {
          const data = await refresh.json();
          setComments((prev) => ({ ...prev, [reviewId]: data }));
        }
      }
    } catch {
      // Revert on error
      setComments((prev) => ({
        ...prev,
        [reviewId]: (prev[reviewId] || []).filter((c) => c.id !== optimisticComment.id),
      }));
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthUser(data.user ?? null)).catch(() => {});
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [reviewsRes, statsRes] = await Promise.all([
        fetch(`/api/reviews?tmdbId=${tmdbId}&mediaType=${mediaType}`),
        fetch(`/api/reviews?tmdbId=${tmdbId}&mediaType=${mediaType}&stats=true`),
      ]);
      if (reviewsRes.ok) setReviews(await reviewsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tmdbId, mediaType]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Re-fetch stats when tracking status or version changes
  useEffect(() => {
    fetchAll();
  }, [trackStatus, trackVersion, fetchAll]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("Please write a review");
      return;
    }
    if (content.trim().length < 5) {
      setError("Review must be at least 5 characters");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          content: content.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to submit");
        return;
      }

      const newReview = await res.json();
      setReviews((prev) => [newReview, ...prev]);
      setContent("");
      fetchAll();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLike(reviewId: string) {
    if (!authUser) return;

    const review = reviews.find((r) => r.id === reviewId);
    if (!review) return;

    const action = review.liked ? "unlike" : "like";

    // Optimistic update
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, liked: !review.liked, likes: r.likes + (review.liked ? -1 : 1) }
          : r
      )
    );

    try {
      const res = await fetch("/api/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, action }),
      });
      if (res.ok) {
        const { likes } = await res.json();
        setReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, likes, liked: !review.liked } : r))
        );
      } else {
        // Revert on error
        fetchAll();
      }
    } catch {
      fetchAll();
    }
  }

  const isWatched = trackStatus === "completed";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Reviews</h2>
        {stats && stats.total > 0 && (
          <span className="text-xs text-[#9ca3af]">
            {stats.total}
          </span>
        )}
      </div>

      {/* Rating stats — only when reviews exist */}
      {stats && stats.total > 0 && (
        <div className="mb-4">
          <RatingStats stats={stats} />
        </div>
      )}

      {/* Write review — only if watched */}
      {isWatched ? (
        authUser ? (
        <form
          onSubmit={handleSubmit}
          className="bg-[#1a1a2e] rounded-xl p-4 mb-4 space-y-3"
        >
          <textarea
            placeholder="Write your review..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full bg-[#25253a] text-white text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[#6366f1] transition-colors placeholder:text-[#6b7280] resize-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
        ) : (
        <div className="bg-[#1a1a2e] rounded-xl p-4 mb-4 text-center border border-[#2d2d4a]">
          <p className="text-sm text-[#6b7280] mb-2">Sign in to write a review</p>
          <a href="/signup" className="inline-block px-4 py-1.5 bg-[#6366f1] text-white text-sm font-medium rounded-lg hover:bg-[#818cf8] transition-colors">
            Create account
          </a>
        </div>
        )
      ) : (
        <div className="bg-[#1a1a2e] rounded-xl p-4 mb-4 text-center border border-[#2d2d4a]">
          <p className="text-sm text-[#6b7280] mb-2">Sign in to write a review</p>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <p className="text-xs text-[#6b7280]">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="text-2xl mb-2">💬</span>
          <p className="text-sm text-[#6b7280]">No reviews yet</p>
          <p className="text-xs text-[#6b7280]/70 mt-0.5">Be the first to share your thoughts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="bg-[#1a1a2e] rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center text-[10px] font-bold text-white">
                    {review.username[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white">
                    {review.username}
                  </span>
                  {renderStars(review.rating)}
                </div>
                <span className="text-[10px] text-[#6b7280]">
                  {formatDate(review.createdAt)}
                </span>
              </div>
              <p className="text-sm text-[#d1d5db] leading-relaxed whitespace-pre-wrap">
                {review.content}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => handleLike(review.id)}
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    review.liked ? "text-[#6366f1]" : "text-[#6b7280] hover:text-[#6366f1]"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                    fill={review.liked ? "currentColor" : "none"} stroke="currentColor"
                    strokeWidth={review.liked ? "0" : "1.5"} className="w-3.5 h-3.5">
                    <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268-.14-.526-.292-.712A2.02 2.02 0 009.22.51L6.843 2.889A5.939 5.939 0 004.5 6.988V17.5h8.365a2.254 2.254 0 002.202-1.722l1.385-5.5A2.25 2.25 0 0014.25 7.5h-3.795l.612-3.16A8.13 8.13 0 0011 3z" />
                  </svg>
                  <span>{review.likes || 0}</span>
                </button>
                <button
                  onClick={() => toggleComments(review.id, review.username)}
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    expandedComments.has(review.id) ? "text-[#a855f7]" : "text-[#6b7280] hover:text-[#a855f7]"
                  }`}
                >
                  <span>💬</span>
                  <span>{(comments[review.id] || []).length || "Comment"}</span>
                </button>
              </div>

              {/* ── Comments Section ── */}
              {expandedComments.has(review.id) && (
                <div className="mt-3 pt-3 border-t border-[#2d2d4a]">
                  {loadingComments.has(review.id) ? (
                    <p className="text-xs text-[#6b7280]">Loading comments...</p>
                  ) : (comments[review.id] || []).length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {(comments[review.id] || []).map((c: any) => (
                        <div key={c.id} className="flex gap-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 mt-0.5">
                            {c.username[0]?.toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-medium text-white mr-2">{c.username}</span>
                            <span className="text-xs text-[#d1d5db] whitespace-pre-wrap">{c.content}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#6b7280] mb-3">No comments yet</p>
                  )}

                  {/* Comment input */}
                  {authUser ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={commentInputs[review.id] || ""}
                        onChange={(e) => setCommentInputs((prev) => ({ ...prev, [review.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitComment(review.id, review.username, tmdbId, "");
                          }
                        }}
                        maxLength={1000}
                        className="flex-1 bg-[#25253a] text-white text-xs rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[#6366f1] transition-colors placeholder:text-[#6b7280]"
                      />
                      <button
                        onClick={() => submitComment(review.id, review.username, tmdbId, "")}
                        disabled={!commentInputs[review.id]?.trim()}
                        className="px-3 py-1.5 bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
                      >
                        Post
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[#6b7280]">
                      <a href="/signup" className="text-[#6366f1] hover:underline">Sign in</a> to comment
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Watcha‑style RatingStats ── */

function RatingStats({ stats }: { stats: RatingStatsData | null }) {
  const buckets = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
  const BAR_HEIGHT = 80;

  if (!stats || stats.total === 0) return null;

  const distribution: Record<number, number> = {};
  let total = 0;
  let sum = 0;

  for (const b of buckets) {
    distribution[b] = stats.distribution[b] || 0;
    total += distribution[b];
    sum += b * distribution[b];
  }

  const average = total > 0 ? sum / total : 0;
  const maxCount = Math.max(...buckets.map((b) => distribution[b]), 1);

  return (
    <div style={{ padding: "12px 16px" }}>
      {/* Average rating */}
      <p style={{ fontSize: 13, fontWeight: 500, color: "#d1d5db", margin: 0 }}>Rating</p>
      <p style={{ fontSize: 34, fontWeight: 700, color: "#fff", lineHeight: 1.1, margin: 0 }}>
        {average > 0 ? average.toFixed(1) : "—"}
      </p>

      {/* Total reviews */}
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4, marginBottom: 0 }}>Total reviews</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>
        {total >= 10000 ? `${(total / 10000).toFixed(1)}만` : total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total)}
      </p>

      {/* Vertical bar chart — absolute positioning, guaranteed unified baseline */}
      <div style={{ position: "relative", height: BAR_HEIGHT, marginTop: 16 }}>
        {/* Bars — each positioned directly at bottom: 14px, centered in column */}
        {buckets.map((star, i) => {
          const count = distribution[star] || 0;
          const barMaxH = BAR_HEIGHT - 14; // bar area height
          const barH = count > 0 ? Math.max((count / maxCount) * barMaxH, 4) : 0;
          const barColor = "#ff2f6e";
          const colWidth = 100 / buckets.length;
          return (
            <div
              key={`bar-${star}`}
              style={{
                position: "absolute",
                bottom: 14,
                left: `${i * colWidth + colWidth / 2}%`,
                transform: "translateX(-50%)",
                width: 20,
                height: barH,
                backgroundColor: barColor,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                transition: "height 0.5s",
              }}
            />
          );
        })}
        {/* Labels — positioned at bottom: 0, centered in column */}
        {buckets.map((star, i) => {
          const colWidth = 100 / buckets.length;
          return (
            <span
              key={`lbl-${star}`}
              style={{
                position: "absolute",
                bottom: 0,
                left: `${i * colWidth}%`,
                width: `${colWidth}%`,
                fontSize: 10,
                fontWeight: 500,
                color: "#6b7280",
                lineHeight: "14px",
                textAlign: "center",
              }}
            >
              {star % 1 === 0 ? star : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
