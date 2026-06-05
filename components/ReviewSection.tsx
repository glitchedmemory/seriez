"use client";

import { useState, useEffect, useCallback } from "react";
import { StarInput } from "@/components/StarInput";

/* ── Render 5 stars with half‑star support (linear‑gradient) ── */
function renderStars(rating: number) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fill = rating >= i ? 100 : rating >= i - 0.5 ? 50 : 0;
    stars.push(
      <span
        key={i}
        className="text-sm"
        style={{
          background: fill > 0
            ? `linear-gradient(to right, #f59e0b ${fill}%, #4b5563 ${fill}%)`
            : "#4b5563",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        ★
      </span>
    );
  }
  return <span className="inline-flex gap-px">{stars}</span>;
}

interface Review {
  id: string;
  username: string;
  content: string;
  rating: number;
  likes: number;
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
}: {
  tmdbId: number;
  mediaType: string;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<RatingStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("reelist_username");
    if (saved) setUsername(saved);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !content.trim() || rating === 0) {
      setError("Please fill in all fields and select a rating");
      return;
    }
    if (username.trim().length > 20) {
      setError("Username must be under 20 characters");
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
          username: username.trim(),
          content: content.trim(),
          rating,
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
      setRating(0);
      fetchAll();
      localStorage.setItem("reelist_username", username.trim());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLike(reviewId: string) {
    try {
      const res = await fetch("/api/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, action: "like" }),
      });
      if (res.ok) {
        const { likes } = await res.json();
        setReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, likes } : r))
        );
      }
    } catch {
      // silent
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Reviews</h2>
        {stats && stats.total > 0 && (
          <span className="text-xs text-[#9ca3af]">
            {stats.total.toLocaleString()}
          </span>
        )}
      </div>

      {/* Rating stats — always shown */}
      <div className="mb-4">
        <RatingStats stats={stats} />
      </div>

      {/* Write review form */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#1a1a2e] rounded-xl p-4 mb-4 space-y-3"
      >
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            className="flex-1 bg-[#25253a] text-white text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[#6366f1] transition-colors placeholder:text-[#6b7280]"
          />
          <StarInput value={rating} onChange={setRating} />
        </div>
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

      {/* Reviews list */}
      {loading ? (
        <p className="text-xs text-[#6b7280]">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-xs text-[#6b7280]">
          No reviews yet. Be the first!
        </p>
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
                  {new Date(review.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <p className="text-sm text-[#d1d5db] leading-relaxed whitespace-pre-wrap">
                {review.content}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <button
                  onClick={() => handleLike(review.id)}
                  className="flex items-center gap-1 text-xs text-[#6b7280] hover:text-[#6366f1] transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268-.14-.526-.292-.712A2.02 2.02 0 009.22.51L6.843 2.889A5.939 5.939 0 004.5 6.988V17.5h8.365a2.254 2.254 0 002.202-1.722l1.385-5.5A2.25 2.25 0 0014.25 7.5h-3.795l.612-3.16A8.13 8.13 0 0011 3z" />
                  </svg>
                  <span>{review.likes || 0}</span>
                </button>
              </div>
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
  const BAR_HEIGHT = 80; // px — fixed, not Tailwind arbitrary value

  // Sample data fallback
  const SAMPLE: Record<number, number> = {
    0.5: 3, 1.0: 5, 1.5: 7, 2.0: 12, 2.5: 18,
    3.0: 25, 3.5: 38, 4.0: 52, 4.5: 41, 5.0: 28,
  };

  const hasRealData = stats && stats.total > 0;
  const distribution: Record<number, number> = {};
  let total = 0;
  let sum = 0;

  if (hasRealData) {
    for (const b of buckets) {
      distribution[b] = stats!.distribution[b] || 0;
      total += distribution[b];
      sum += b * distribution[b];
    }
  } else {
    for (const b of buckets) {
      distribution[b] = SAMPLE[b];
      total += distribution[b];
      sum += b * distribution[b];
    }
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
        {total >= 10000 ? `${(total / 10000).toFixed(1)}만` : total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total.toLocaleString()}
      </p>

      {/* Vertical bar chart — absolute positioning, guaranteed unified baseline */}
      <div style={{ position: "relative", height: BAR_HEIGHT, marginTop: 16 }}>
        {/* Bars — each positioned directly at bottom: 14px, centered in column */}
        {buckets.map((star, i) => {
          const count = distribution[star] || 0;
          const barMaxH = BAR_HEIGHT - 14; // bar area height
          const barH = count > 0 ? Math.max((count / maxCount) * barMaxH, 4) : 0;
          const barColor = star <= Math.round(average * 2) / 2 ? "#ff2f6e" : "#374151";
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
