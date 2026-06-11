"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Reddit-style comment tree:
 *  Max 2 depth inline, deeper levels collapsed into "Continue this thread →".
 *  Max 3 siblings shown, rest behind "Show more replies" button.
 */
const THREAD_COLORS = [
  "border-[#6366f1]",   // depth 1
  "border-[#a855f7]",   // depth 2
  "border-[#22c55e]",   // depth 3+
];
const MAX_SIBLINGS = 3;  // max siblings shown inline per parent
const MAX_DEPTH = 2;      // depth 0,1,2 inline; 3+ collapsed

function CommentTree({
  comments,
  depth,
  parentId,
  isAdmin,
  onReport,
  onDelete,
  onReply,
  onToggleReply,
  onReplyChange,
  reportingComments,
  replyInputs,
  replyingTo,
  expandedThreads,
  onToggleThread,
  onLike,
  reviewId,
  reviewTmdbId,
  reviewAuthor,
  titleName,
  authUsername,
  avatarUrls,
}: {
  comments: any[];
  depth: number;
  parentId?: number;
  isAdmin: boolean;
  onReport: (commentId: number) => void;
  onDelete: (commentId: number) => void;
  onReply: (commentId: number) => void;
  onToggleReply: (commentId: number) => void;
  onReplyChange: (commentId: number, text: string) => void;
  reportingComments: Set<string>;
  replyInputs: Record<string, string>;
  replyingTo: Record<string, string | null>;
  expandedThreads: Set<string>;
  onToggleThread: (commentId: number | string) => void;
  onLike: (commentId: number) => void;
  reviewId: string;
  reviewTmdbId: number;
  reviewAuthor: string;
  titleName: string;
  authUsername?: string;
  avatarUrls?: Record<string, string | null>;
}) {
  const router = useRouter();
  const nodes = parentId != null
    ? comments.filter((c: any) => c.parent_id === parentId)
    : comments.filter((c: any) => c.parent_id == null);

  if (nodes.length === 0) return null;

  // Sort: most recent first
  const sorted = [...nodes].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  const isExpanded = expandedThreads.has(String(parentId ?? "root"));
  const visible = isExpanded ? sorted : sorted.slice(0, MAX_SIBLINGS);
  const hidden = sorted.length - visible.length;
  const showMore = hidden > 0 && !isExpanded;
  const beyondDepth = depth >= MAX_DEPTH;

  return (
    <div className={depth === 0 ? "space-y-1 mb-3" : `border-l-2 ${THREAD_COLORS[Math.min(depth - 1, 2)]} ml-2 pl-3 space-y-1`}>
      {visible.map((c: any) => {
        const replyCount = comments.filter((cc: any) => cc.parent_id === c.id).length;
        const hasChildren = replyCount > 0;
        const childExpanded = expandedThreads.has(String(c.id));
        return (
          <div key={c.id}>
            <div className="flex gap-2">
              {avatarUrls?.[c.username] ? (
                <img src={avatarUrls[c.username]!} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 mt-0.5 bg-gradient-to-br from-[#6366f1] to-[#a855f7]">
                  {c.username[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-white hover:text-[#6366f1] cursor-pointer transition-colors" onClick={() => router.push(`/profile?username=${c.username}`)}>{c.username}</span>
                  {c.isPremium && <img src="/icons/premium-badge-20.png" alt="Premium" className="w-4 h-2.5 inline-block" />}
                  {isAdmin && c.is_hidden && (
                    <span className="text-[10px] text-red-400 bg-red-900/30 px-1 rounded">🚨 hidden</span>
                  )}
                  {authUsername !== c.username && (
                    <button onClick={() => authUsername ? onReport(c.id) : router.push("/login")}
                      disabled={reportingComments.has(String(c.id)) && !!authUsername}
                      className="text-[10px] text-[#6b7280] hover:text-red-400 transition-colors disabled:opacity-50 ml-auto"
                      title="Report"><img src="/report-button.png" alt="Report" className="h-4 w-auto opacity-70 group-hover:opacity-100" /></button>
                  )}
                  {isAdmin && c.is_hidden && (
                    <button onClick={() => onDelete(c.id)}
                      className="text-[10px] text-red-400 hover:text-red-300 ml-1">🗑️</button>
                  )}
                </div>
                <span className="text-xs text-[#d1d5db] whitespace-pre-wrap">{c.content}</span>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => onLike(c.id)}
                    className={`flex items-center gap-1 text-[10px] transition-colors ${
                      c.liked ? "text-[#6366f1]" : "text-[#6b7280] hover:text-[#6366f1]"
                    }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                      fill={c.liked ? "currentColor" : "none"} stroke="currentColor"
                      strokeWidth={c.liked ? "0" : "1.5"} className="w-3 h-3">
                      <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268-.14-.526-.292-.712A2.02 2.02 0 009.22.51L6.843 2.889A5.939 5.939 0 004.5 6.988V17.5h8.365a2.254 2.254 0 002.202-1.722l1.385-5.5A2.25 2.25 0 0014.25 7.5h-3.795l.612-3.16A8.13 8.13 0 0011 3z" />
                    </svg>
                    <span>{c.likes || 0}</span>
                  </button>
                  <button onClick={() => authUsername ? onToggleReply(c.id) : router.push("/login")}
                    className="text-[10px] text-[#6b7280] hover:text-[#a855f7] transition-colors">💬 Reply</button>
                  {hasChildren && (
                    <button onClick={() => onToggleThread(c.id)}
                      className={`text-[10px] transition-colors ${childExpanded ? "text-[#a855f7]" : "text-[#6b7280] hover:text-[#a855f7]"}`}>
                      {childExpanded ? "▾ Hide replies" : `▸ ${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Reply input */}
            {replyingTo[String(c.id)] != null && (
              <div className="flex gap-2 mt-1 ml-7">
                <input type="text" placeholder="Write a reply..."
                  value={replyInputs[String(c.id)] || ""}
                  onChange={(e) => onReplyChange(c.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onReply(c.id); }}}
                  maxLength={1000}
                  className="flex-1 bg-[#25253a] text-white text-[10px] rounded-lg px-2 py-1.5 outline-none border border-transparent focus:border-[#6366f1] transition-colors placeholder:text-[#6b7280]" />
                <button onClick={() => onReply(c.id)} disabled={!replyInputs[String(c.id)]?.trim()}
                  className="px-2 py-1 bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-40 text-white text-[10px] font-medium rounded-lg transition-colors flex-shrink-0">Post</button>
              </div>
            )}
            {/* Children: inline up to MAX_DEPTH, collapsed beyond */}
            {hasChildren && childExpanded && !beyondDepth && (
              <CommentTree comments={comments} depth={depth + 1} parentId={c.id}
                isAdmin={isAdmin} onReport={onReport} onDelete={onDelete}
                onReply={onReply} onToggleReply={onToggleReply} onReplyChange={onReplyChange}
                reportingComments={reportingComments} replyInputs={replyInputs} replyingTo={replyingTo}
                expandedThreads={expandedThreads} onToggleThread={onToggleThread} onLike={onLike}
                reviewId={reviewId} reviewTmdbId={reviewTmdbId} reviewAuthor={reviewAuthor}
                titleName={titleName} authUsername={authUsername} avatarUrls={avatarUrls} />
            )}
            {/* Deep thread: "Continue this thread" */}
            {hasChildren && beyondDepth && (
              <div className="ml-7 mt-1">
                <button onClick={() => onToggleThread(c.id)}
                  className={`text-[10px] transition-colors ${childExpanded ? "text-[#a855f7]" : "text-[#6366f1] hover:text-[#818cf8]"}`}>
                  {childExpanded ? "▾ Hide thread" : `▸ Continue this thread → (${replyCount} ${replyCount === 1 ? "reply" : "replies"})`}
                </button>
                {childExpanded && (
                  <CommentTree comments={comments} depth={depth + 1} parentId={c.id}
                    isAdmin={isAdmin} onReport={onReport} onDelete={onDelete}
                    onReply={onReply} onToggleReply={onToggleReply} onReplyChange={onReplyChange}
                    reportingComments={reportingComments} replyInputs={replyInputs} replyingTo={replyingTo}
                    expandedThreads={expandedThreads} onToggleThread={onToggleThread} onLike={onLike}
                    reviewId={reviewId} reviewTmdbId={reviewTmdbId} reviewAuthor={reviewAuthor}
                    titleName={titleName} authUsername={authUsername} avatarUrls={avatarUrls} />
                )}
              </div>
            )}
          </div>
        );
      })}
      {/* Show more button for hidden siblings */}
      {showMore && (
        <button
          onClick={() => onToggleThread(parentId ?? "root")}
          className="text-[10px] text-[#6366f1] hover:text-[#818cf8] transition-colors ml-7"
        >
          ▸ Show more replies ({hidden})
        </button>
      )}
    </div>
  );
}

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
  isHidden?: boolean;
  isPremium?: boolean;
  commentCount?: number;
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
  authUser = null,
  trackRating = 0,
}: {
  tmdbId: number;
  mediaType: string;
  trackStatus?: string | null;
  trackVersion?: number;
  authUser?: { email?: string; user_metadata?: { username?: string } } | null;
  trackRating?: number;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<RatingStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [content, setContent] = useState("");
  const supabase = createClient();
  const router = useRouter();

  // ── Comment state ──
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});
  const [reportingReview, setReportingReview] = useState<Set<string>>(new Set());
  const [reportingComments, setReportingComments] = useState<Set<string>>(new Set());
  // Reply state
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<Record<string, string | null>>({});
  // Expand deep chains (empty = all collapsed by default)
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Avatar URLs for reviewers
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});

  // Fetch avatar URLs for all unique reviewers + commenters
  useEffect(() => {
    const reviewUsers = reviews.map(r => r.username);
    const commentUsers = Object.values(comments).flat().map((c: any) => c.username);
    const usernames = [...new Set([...reviewUsers, ...commentUsers])];
    if (usernames.length === 0) return;
    // Use REST API directly — Supabase SDK silently fails for users table in browser
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=username,avatar_url&username=in.(${usernames.map(u => encodeURIComponent(u)).join(",")})`;
    fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    })
      .then(r => r.json())
      .then((rows: { username: string; avatar_url: string | null }[]) => {
        const map: Record<string, string | null> = {};
        rows.forEach(({ username, avatar_url }) => { map[username] = avatar_url; });
        // Fill null for users not found in DB
        usernames.forEach(u => { if (!(u in map)) map[u] = null; });
        setAvatarUrls(map);
      })
      .catch(() => {});
  }, [reviews, comments]);

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

  const submitComment = async (reviewId: string, reviewAuthor: string, reviewTmdbId: number, titleName: string, parentId?: number) => {
    const text = (parentId != null ? replyInputs[String(parentId)] : commentInputs[reviewId])?.trim();
    if (!text || !authUser) return;

    const optimisticComment = {
      id: "optimistic-" + Date.now(),
      username: authUser.user_metadata?.username || authUser.email?.split("@")[0] || "User",
      content: text,
      parent_id: parentId ?? null,
      created_at: new Date().toISOString(),
    };

    setComments((prev) => ({
      ...prev,
      [reviewId]: [...(prev[reviewId] || []), optimisticComment],
    }));
    if (parentId != null) {
      setReplyInputs((prev) => ({ ...prev, [String(parentId)]: "" }));
      setReplyingTo((prev) => ({ ...prev, [String(parentId)]: null }));
    } else {
      setCommentInputs((prev) => ({ ...prev, [reviewId]: "" }));
    }

    try {
      const body: any = {
        review_id: reviewId,
        content: text,
        tmdb_id: reviewTmdbId,
        title_name: titleName,
        review_author: reviewAuthor,
      };
      if (parentId != null) body.parent_id = parentId;

      const res = await fetch("/api/review-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        // Refresh comments
        const refresh = await fetch(`/api/review-comments?review_id=${reviewId}`);
        if (refresh.ok) {
          const data = await refresh.json();
          setComments((prev) => ({ ...prev, [reviewId]: data }));
          // Update comment count on the review
          setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, commentCount: data.length } : r));
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

  const handleReport = async (targetType: "review" | "comment", targetId: string) => {
    if (!authUser) return;
    setReportingReview((prev) => new Set(prev).add(targetId));
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        setReportCounts((prev) => ({ ...prev, [targetId]: data.report_count }));
      }
    } catch {}
    setReportingReview((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!isAdmin) return;
    try {
      await supabase.from("reviews").delete().eq("id", reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } catch {}
  };

  const handleDeleteComment = async (commentId: number, reviewId: string) => {
    if (!isAdmin) return;
    try {
      await supabase.from("review_comments").delete().eq("id", commentId);
      setComments((prev) => ({
        ...prev,
        [reviewId]: (prev[reviewId] || []).filter((c) => c.id !== commentId),
      }));
    } catch {}
  };

  const handleReportComment = (reviewId: string) => async (commentId: number) => {
    if (!authUser) return;
    setReportingComments((prev) => new Set(prev).add(String(commentId)));
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "comment", target_id: String(commentId) }),
      });
      if (res.ok) {
        const data = await res.json();
        setReportCounts((prev) => ({ ...prev, [String(commentId)]: data.report_count }));
      }
    } catch {}
    setReportingComments((prev) => {
      const next = new Set(prev);
      next.delete(String(commentId));
      return next;
    });
  };

  const handleDeleteCommentWrapper = (reviewId: string) => (commentId: number) => {
    handleDeleteComment(commentId, reviewId);
  };

  // ── Comment like ──
  const handleCommentLike = (reviewId: string) => async (commentId: number) => {
    if (!authUser) return;
    const commentList = comments[reviewId] || [];
    const comment = commentList.find((c: any) => c.id === commentId);
    if (!comment) return;

    const action = comment.liked ? "unlike" : "like";

    // Optimistic update
    setComments((prev) => ({
      ...prev,
      [reviewId]: (prev[reviewId] || []).map((c: any) =>
        c.id === commentId
          ? { ...c, liked: !comment.liked, likes: c.likes + (comment.liked ? -1 : 1) }
          : c
      ),
    }));

    try {
      const res = await fetch("/api/review-comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => ({
          ...prev,
          [reviewId]: (prev[reviewId] || []).map((c: any) =>
            c.id === commentId ? { ...c, likes: data.likes, liked: data.liked } : c
          ),
        }));
      } else {
        // Revert
        const refresh = await fetch(`/api/review-comments?review_id=${reviewId}`);
        if (refresh.ok) {
          const refreshed = await refresh.json();
          setComments((prev) => ({ ...prev, [reviewId]: refreshed }));
        }
      }
    } catch {
      const refresh = await fetch(`/api/review-comments?review_id=${reviewId}`);
      if (refresh.ok) {
        const refreshed = await refresh.json();
        setComments((prev) => ({ ...prev, [reviewId]: refreshed }));
      }
    }
  };

  // Reply helpers
  const toggleReply = (reviewId: string) => (commentId: number) => {
    setReplyingTo((prev) => ({
      ...prev,
      [String(commentId)]: prev[String(commentId)] != null ? null : String(commentId),
    }));
  };

  const handleReplyChange = (_reviewId: string) => (commentId: number, text: string) => {
    setReplyInputs((prev) => ({ ...prev, [String(commentId)]: text }));
  };

  const submitReply = (reviewId: string, reviewAuthor: string, reviewTmdbId: number, titleName: string) => (commentId: number) => {
    submitComment(reviewId, reviewAuthor, reviewTmdbId, titleName, commentId);
  };

  // Expand deep chains (empty = all collapsed by default)
  const toggleThread = (commentId: number | string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(String(commentId))) next.delete(String(commentId));
      else next.add(String(commentId));
      return next;
    });
  };

  useEffect(() => {
    if (authUser?.user_metadata?.username) {
      supabase.from("users").select("role").eq("username", authUser.user_metadata.username).maybeSingle()
        .then(
          ({ data: rows }) => setIsAdmin((rows as any)?.role === "admin"),
          () => {}
        );
    }
  }, [authUser]);

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
      const body: Record<string, unknown> = {
        tmdbId,
        mediaType,
        content: content.trim(),
      };
      if (trackRating > 0) body.rating = trackRating;
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          <p className="text-sm text-[#6b7280] mb-2">
            <a href="/signup" className="text-[#6366f1] hover:underline">Sign in</a> to write a review
          </p>
          <a href="/signup" className="inline-block px-4 py-1.5 bg-[#6366f1] text-white text-sm font-medium rounded-lg hover:bg-[#818cf8] transition-colors">
            Create account
          </a>
        </div>
        )
      ) : (
        <div className="bg-[#1a1a2e] rounded-xl p-4 mb-4 text-center border border-[#2d2d4a]">
          {authUser ? (
            <p className="text-sm text-[#6b7280]">
              Mark as <span className="text-pink-400">Watched</span> to write a review
            </p>
          ) : (
            <p className="text-sm text-[#6b7280]">
              <a href="/signup" className="text-[#6366f1] hover:underline">Sign in</a> to write a review
            </p>
          )}
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
                <div className="flex items-center gap-1">
                  {avatarUrls[review.username] ? (
                    <img src={avatarUrls[review.username]!} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-gradient-to-br from-[#6366f1] to-[#a855f7]">
                      {review.username[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-white hover:text-[#6366f1] cursor-pointer transition-colors" onClick={() => router.push(`/profile?username=${review.username}`)}>
                    {review.username}
                  </span>
                  {review.isPremium && <img src="/icons/premium-badge-20.png" alt="Premium" className="w-4 h-2.5 inline-block" />}
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
                  <span>{review.commentCount || "Comment"}</span>
                </button>
                {/* Report button — always visible */}
                {authUser?.user_metadata?.username !== review.username && (
                  <button
                    onClick={() => authUser ? handleReport("review", review.id) : router.push("/login")}
                    disabled={reportingReview.has(review.id)}
                    className="flex items-center gap-1 text-xs text-[#6b7280] hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Report this review"
                  >
                    <img src="/report-button.png" alt="Report" className="h-5 w-auto" />
                  </button>
                )}
                {/* Admin: delete hidden review */}
                {isAdmin && review.isHidden && (
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <span>🗑️</span>
                    <span>Delete</span>
                  </button>
                )}
              </div>
              {/* Hidden indicator for admin */}
              {isAdmin && review.isHidden && (
                <div className="mt-2 px-2 py-1 bg-red-900/30 border border-red-800/50 rounded text-[10px] text-red-300">
                  🚨 Hidden
                </div>
              )}

              {/* ── Comments Section ── */}
              {expandedComments.has(review.id) && (
                <div className="mt-3 pt-3 border-t border-[#2d2d4a]">
                  {loadingComments.has(review.id) ? (
                    <p className="text-xs text-[#6b7280]">Loading comments...</p>
                  ) : (comments[review.id] || []).length > 0 ? (
                    <CommentTree
                      comments={comments[review.id] || []}
                      depth={0}
                      isAdmin={isAdmin}
                      onReport={handleReportComment(review.id)}
                      onDelete={handleDeleteCommentWrapper(review.id)}
                      onReply={submitReply(review.id, review.username, tmdbId, "")}
                      onToggleReply={toggleReply(review.id)}
                      onReplyChange={handleReplyChange(review.id)}
                      reportingComments={reportingComments}
                      replyInputs={replyInputs}
                      replyingTo={replyingTo}
                      expandedThreads={expandedThreads}
                      onToggleThread={toggleThread}
                      onLike={handleCommentLike(review.id)}
                      reviewId={review.id}
                      reviewTmdbId={tmdbId}
                      reviewAuthor={review.username}
                      titleName=""
                      authUsername={authUser?.user_metadata?.username}
                      avatarUrls={avatarUrls}
                    />
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
  const BAR_WIDTH = 24;
  const BAR_GAP = 6;

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

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Bars row */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: BAR_GAP, height: BAR_HEIGHT }}>
        {buckets.map((star) => {
          const count = distribution[star] || 0;
          const barMaxH = BAR_HEIGHT - 14;
          const barH = count > 0 ? Math.max((count / maxCount) * barMaxH, 4) : 0;
          return (
            <div
              key={`bar-${star}`}
              style={{
                width: BAR_WIDTH,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: barH,
                  backgroundColor: "#ff2f6e",
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  minHeight: count > 0 ? 4 : 0,
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Labels row */}
      <div style={{ display: "flex", gap: BAR_GAP, marginTop: 6 }}>
        {buckets.map((star) => (
          <div key={`lbl-${star}`} style={{ width: BAR_WIDTH, textAlign: "center" }}>
            <span style={{ fontSize: 10, color: "#6b7280" }}>
              {star % 1 === 0 ? star : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
