"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Card-style comment tree (Instagram + Discord blend):
 *  - Each comment is a distinct card (rounded, subtle background).
 *  - Max 2-depth nesting (reply to reply allowed).
 *  - 3+ replies collapsed behind "Show N more replies" toggle (clean preview).
 *  - Consecutive same-author comments: avatar+name shown once, subsequent content compact.
 */
const MAX_DEPTH = 2;
const MAX_VISIBLE_REPLIES = 2;

/** Collect all descendant comment IDs in thread order (BFS: direct children first, then their children, etc.) */
function getAllDescendants(parentId: number, allComments: any[]): any[] {
  const result: any[] = [];
  const queue = allComments.filter((c: any) => c.parent_id === parentId);
  for (const node of queue) {
    result.push(node);
    const children = allComments.filter((c: any) => c.parent_id === node.id);
    queue.push(...children);
  }
  return result;
}

function CommentCard({
  c,
  isAdmin,
  onReport,
  onDelete,
  onReply,
  onToggleReply,
  onReplyChange,
  reportingComments,
  replyInputs,
  replyingTo,
  onLike,
  reviewId,
  reviewTmdbId,
  reviewAuthor,
  titleName,
  authUsername,
  avatarUrls,
  reportCounts,
  compact,
  replyCount,
}: {
  c: any;
  isAdmin: boolean;
  onReport: (commentId: number, reason?: string) => void;
  onDelete: (commentId: number) => void;
  onReply: (commentId: number) => void;
  onToggleReply: (commentId: number) => void;
  onReplyChange: (commentId: number, text: string) => void;
  reportingComments: Set<string>;
  replyInputs: Record<string, string>;
  replyingTo: Record<string, string | null>;
  onLike: (commentId: number) => void;
  reviewId: string;
  reviewTmdbId: number;
  reviewAuthor: string;
  titleName: string;
  authUsername?: string;
  avatarUrls?: Record<string, string | null>;
  reportCounts?: Record<string, number>;
  compact: boolean;
  replyCount: number;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [commentPopover, setCommentPopover] = useState<string | null>(null);

  return (
    <div>
      {/* Header row (avatar + username + actions) — hidden in compact mode */}
      {!compact && (
        <div className="flex items-center gap-2 mb-1.5">
          <div className="relative flex-shrink-0">
          {avatarUrls?.[c.username] ? (
            <img src={avatarUrls[c.username]!} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <img src="/icons/default-avatar.png" alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          )}
          <div className="absolute -top-[7px] -left-[7px] w-[54px] h-[54px] pointer-events-none z-10">
            <img src="/icons/avatar-frame-ornate.png?v=4" alt="" className="w-full h-full" />
          </div>
          </div>
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <span className="text-xs font-medium text-text-primary hover:text-accent cursor-pointer transition-colors truncate" onClick={() => router.push(`/profile?username=${c.username}`)}>{c.username}</span>
            {c.isPremium && <img src="/icons/premium-badge-20.png" alt="Golden Ticket" className="w-4 h-2.5 inline-block flex-shrink-0" />}
            {isAdmin && c.is_hidden && (
              <span className="text-[10px] text-red-400 bg-red-900/30 px-1 rounded flex-shrink-0">🚨 hidden</span>
            )}
            <span className="text-[10px] text-text-secondary/60 ml-1">{formatDate(c.created_at)}</span>
            {/* actions pushed right */}
            <div className="ml-auto flex items-center gap-1">
              {authUsername !== c.username && (
                <div className="relative inline-block">
                  <button onClick={() => setCommentPopover(commentPopover === String(c.id) ? null : String(c.id))}
                    disabled={reportingComments.has(String(c.id)) && !!authUsername}
                    className={`text-[11px] transition-colors disabled:opacity-50 ${
                      (reportCounts?.[String(c.id)] || 0) > 0
                        ? "text-green-400"
                        : "text-text-secondary hover:text-red-400"
                    }`}
                    title={reportCounts?.[String(c.id)] ? "Reported ✓" : "Report"}>
                    {reportCounts?.[String(c.id)] ? "✓ Reported" : (
                      <span><img src="/report-button.png?v=2" alt="Report" className="h-5 w-auto opacity-70 hover:opacity-100" /></span>
                    )}
                  </button>
                  {commentPopover === String(c.id) && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-bg-card border border-border rounded-lg shadow-xl py-1 min-w-[140px]">
                      {["inappropriate","spam","obscenity","hate_speech","spoiler","other"].map((r) => (
                        <button key={r}
                          onClick={() => { onReport(c.id, r); setCommentPopover(null); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors">
                          {r === "inappropriate" ? "👎 Inappropriate" : r === "spam" ? "📢 Spam" : r === "obscenity" ? "🔞 Obscenity" : r === "hate_speech" ? "🗣️ Hate Speech" : r === "spoiler" ? "🚨 Spoiler" : "··· Other"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {authUsername === c.username && (
                confirmDelete === c.id ? (
                  <span className="flex items-center gap-1">
                    <button onClick={() => { onDelete(c.id); setConfirmDelete(null); }}
                      className="text-[9px] px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-500">Del</button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="text-[9px] text-text-secondary hover:text-white light:hover:text-accent">Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDelete(c.id)}
                    className="text-[10px] text-text-secondary hover:text-red-400 transition-colors"
                    title="Delete your comment">🗑️</button>
                )
              )}
              {isAdmin && c.is_hidden && (
                <button onClick={() => onDelete(c.id)}
                  className="text-[10px] text-red-400 hover:text-red-300">🗑️</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <span className={`text-xs text-[#d1d5db] light:text-text-primary/85 whitespace-pre-wrap ${compact ? "" : ""}`}>{c.content}</span>

      {/* Actions row */}
      <div className={`flex items-center gap-2 ${compact ? "mt-0.5" : "mt-1.5"}`}>
        <button onClick={() => onLike(c.id)}
          className={`flex items-center gap-1 text-[10px] transition-colors ${
            c.liked ? "text-accent" : "text-text-secondary hover:text-accent"
          }`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
            fill={c.liked ? "currentColor" : "none"} stroke="currentColor"
            strokeWidth={c.liked ? "0" : "1.5"} className="w-3 h-3">
            <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268-.14-.526-.292-.712A2.02 2.02 0 009.22.51L6.843 2.889A5.939 5.939 0 004.5 6.988V17.5h8.365a2.254 2.254 0 002.202-1.722l1.385-5.5A2.25 2.25 0 0014.25 7.5h-3.795l.612-3.16A8.13 8.13 0 0011 3z" />
          </svg>
          <span>{c.likes || 0}</span>
        </button>
        <button onClick={() => authUsername ? onToggleReply(c.id) : router.push("/login")}
          className="text-[10px] text-text-secondary hover:text-accent-light transition-colors">💬 {replyCount || "Reply"}</button>
        {compact && (
          <span className="text-[10px] text-text-secondary/50 ml-auto">{formatDate(c.created_at)}</span>
        )}
      </div>

      {/* Reply input */}
      {replyingTo[String(c.id)] != null && (
        <div className="flex gap-2 mt-2">
          <input type="text" placeholder="Write a reply..."
            value={replyInputs[String(c.id)] || ""}
            onChange={(e) => onReplyChange(c.id, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onReply(c.id); }}}
            maxLength={1000}
            className="flex-1 bg-bg-surface text-text-primary text-[10px] rounded-lg px-2 py-1.5 outline-none border border-transparent focus:border-accent transition-colors placeholder:text-text-secondary" />
          <button onClick={() => onReply(c.id)} disabled={!replyInputs[String(c.id)]?.trim()}
            className="px-2 py-1 bg-accent hover:bg-[#5558e6] disabled:opacity-40 text-text-primary light:text-white text-[10px] font-medium rounded-lg transition-colors flex-shrink-0">Post</button>
        </div>
      )}
    </div>
  );
}

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
  reportCounts,
}: {
  comments: any[];
  depth: number;
  parentId?: number;
  isAdmin: boolean;
  onReport: (commentId: number, reason?: string) => void;
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
  reportCounts?: Record<string, number>;
}) {
  const nodes = parentId != null
    ? comments.filter((c: any) => c.parent_id === parentId)
    : comments.filter((c: any) => c.parent_id == null);

  if (nodes.length === 0) return null;

  // Sort newest first
  const sorted = [...nodes].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  const isTopLevel = depth === 0;
  const allowNestedReply = depth < MAX_DEPTH;

  // For replies (depth>0), collapse beyond MAX_VISIBLE_REPLIES
  const threadKey = String(parentId ?? "root");
  const isExpanded = expandedThreads.has(threadKey);
  const visible = isTopLevel ? sorted : (isExpanded ? sorted : sorted.slice(0, MAX_VISIBLE_REPLIES));
  const hiddenCount = sorted.length - visible.length;
  const showMore = hiddenCount > 0 && !isExpanded;

  const sharedProps = {
    isAdmin, onReport, onDelete, onReply, onToggleReply, onReplyChange,
    reportingComments, replyInputs, replyingTo, onLike,
    reviewId, reviewTmdbId, reviewAuthor, titleName,
    authUsername, avatarUrls, reportCounts,
  };

  return (
    <div className={isTopLevel ? "space-y-2 mb-3 ml-6" : "ml-6 mt-1.5 space-y-1.5"}>
      {visible.map((c: any, idx: number) => {
        // Consecutive same-author detection
        const prevAuthor = idx > 0 ? visible[idx - 1].username : null;
        const sameAuthor = prevAuthor === c.username;

        const replyCount = comments.filter((cc: any) => cc.parent_id === c.id).length;
        const hasReplies = replyCount > 0;

        return (
          <div key={c.id}>
            {/* Card wrapper */}
            <div className={
              isTopLevel
                ? "bg-bg-surface rounded-xl p-3"
                : `bg-bg-card rounded-lg p-2.5 ${sameAuthor ? "pt-1.5" : ""}`
            }>
              <CommentCard
                c={c}
                {...sharedProps}
                compact={sameAuthor}
                replyCount={replyCount}
              />

              {/* Reply input (shown when replying to this comment) */}
              {/* (already inside CommentCard) */}
            </div>

            {/* Flat reply list — all descendants, no deep nesting */}
            {hasReplies && (() => {
              const allDescendants = getAllDescendants(c.id, comments);
              if (allDescendants.length === 0) return null;
              const replyKey = `flat-${c.id}`;
              const replyExpanded = expandedThreads.has(replyKey);
              const visibleReplies = replyExpanded ? allDescendants : allDescendants.slice(0, MAX_VISIBLE_REPLIES);
              const hiddenCnt = allDescendants.length - visibleReplies.length;
              return (
                <div className="space-y-1.5 mt-1.5">
                  {visibleReplies.map((dc: any, idx: number) => {
                    const prevAuthor = idx > 0 ? visibleReplies[idx - 1].username : null;
                    const sameAuthorDc = prevAuthor === dc.username;
                    return (
                      <div key={dc.id} className="bg-bg-card rounded-lg p-2.5">
                        <CommentCard c={dc} {...sharedProps} compact={idx > 0 && sameAuthorDc} replyCount={comments.filter((cc: any) => cc.parent_id === dc.id).length} />
                      </div>
                    );
                  })}
                  {hiddenCnt > 0 && !replyExpanded && (
                    <button onClick={() => onToggleThread(replyKey)}
                      className="text-[10px] text-accent hover:text-[#818cf8] transition-colors">
                      ▸ Show {hiddenCnt} more {hiddenCnt === 1 ? "reply" : "replies"}
                    </button>
                  )}
                  {replyExpanded && allDescendants.length > MAX_VISIBLE_REPLIES && (
                    <button onClick={() => onToggleThread(replyKey)}
                      className="text-[10px] text-text-secondary hover:text-accent transition-colors">
                      ▴ Show less
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}
      {/* Show N more replies toggle (replies only, not top-level) */}
      {showMore && (
        <button
          onClick={() => onToggleThread(threadKey)}
          className="text-[10px] text-accent hover:text-[#818cf8] transition-colors ml-6 mt-1"
        >
          ▸ Show {hiddenCount} more {hiddenCount === 1 ? "reply" : "replies"}
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
  const [totalReviews, setTotalReviews] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const REVIEWS_PER_PAGE = 7;
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
  const [reportPopover, setReportPopover] = useState<string | null>(null);
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

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const getUsername = () => authUser?.user_metadata?.username || "";

  const handleReport = async (targetType: "review" | "comment", targetId: string, reason?: string) => {
    if (!authUser) return;
    const username = getUsername();
    if (!username) return;
    setReportingReview((prev) => new Set(prev).add(targetId));
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, username, reason: reason || "other" }),
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
    const username = getUsername();
    if (!username || !reviewId) return;
    setDeletingId(reviewId);
    try {
      const res = await fetch(`/api/reviews?reviewId=${reviewId}&username=${encodeURIComponent(username)}`, { method: "DELETE" });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to delete");
      }
    } catch {
      alert("Network error");
    }
    setDeletingId(null);
  };

  const handleDeleteComment = async (commentId: number, reviewId: string) => {
    const username = getUsername();
    if (!username) return;
    try {
      const res = await fetch(`/api/review-comments?commentId=${commentId}&username=${encodeURIComponent(username)}`, { method: "DELETE" });
      if (res.ok) {
        setComments((prev) => ({
          ...prev,
          [reviewId]: (prev[reviewId] || []).filter((c) => c.id !== commentId),
        }));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to delete comment");
      }
    } catch {
      alert("Network error — please try again");
    }
  };

  const handleReportComment = (reviewId: string) => async (commentId: number, reason?: string) => {
    if (!authUser) return;
    setReportingComments((prev) => new Set(prev).add(String(commentId)));
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "comment", target_id: String(commentId), username: getUsername(), reason: reason || "other" }),
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

  const fetchAll = useCallback(async (pageNum = 1) => {
    try {
      const [reviewsRes, statsRes] = await Promise.all([
        fetch(`/api/reviews?tmdbId=${tmdbId}&mediaType=${mediaType}&page=${pageNum}&limit=${REVIEWS_PER_PAGE}`),
        fetch(`/api/reviews?tmdbId=${tmdbId}&mediaType=${mediaType}&stats=true`),
      ]);
      if (reviewsRes.ok) {
        const data = await reviewsRes.json();
        setReviews(data.reviews || []);
        setTotalReviews(data.total || 0);
        setCurrentPage(data.page || 1);
        setTotalPages(Math.max(1, Math.ceil((data.total || 0) / REVIEWS_PER_PAGE)));
      }
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
    fetchAll(1);
  }, [trackStatus, trackVersion]);

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    fetchAll(p);
  }

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
        <h2 className="text-lg font-semibold text-text-primary">Reviews</h2>
        {stats && stats.total > 0 && (
          <span className="text-xs text-text-secondary">
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

      {/* Write review — available for all signed-in users */}
      {authUser ? (
        <form
          onSubmit={handleSubmit}
          className="bg-bg-card rounded-xl p-4 mb-4 space-y-3"
        >
          <textarea
            placeholder="Write your review..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full bg-bg-surface text-text-primary text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-accent transition-colors placeholder:text-text-secondary resize-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 bg-accent hover:bg-[#5558e6] disabled:opacity-50 text-text-primary light:text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      ) : (
        <div className="bg-bg-card rounded-xl p-4 mb-4 text-center border border-border">
          <p className="text-sm text-text-secondary mb-2">
            <a href="/signup" className="text-accent hover:underline">Sign in</a> to write a review
          </p>
          <a href="/signup" className="inline-block px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-[#818cf8] transition-colors">
            Create account
          </a>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <p className="text-xs text-text-secondary">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="text-2xl mb-2">💬</span>
          <p className="text-sm text-text-secondary">No reviews yet</p>
          <p className="text-xs text-text-secondary/70 mt-0.5">Be the first to share your thoughts</p>
        </div>
      ) : (() => {
        // Pinned: top 2 by likes (only on page 1)
        const pinnedReviews = currentPage === 1
          ? [...reviews].sort((a, b) => b.likes - a.likes).slice(0, 2).filter(r => r.likes > 0)
          : [];
        const pinnedIds = new Set(pinnedReviews.map(r => r.id));
        // All reviews sorted chronologically (newest first)
        const allByTime = [...reviews].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const ReviewCard = ({ review, isPinned }: { review: Review; isPinned?: boolean }) => (
          <div key={review.id} className={`relative overflow-hidden rounded-2xl p-5 transition-all duration-300 ${
            isPinned
              ? "bg-white/[0.03] light:bg-bg-card backdrop-blur-xl border border-gold/45 shadow-[0_0_20px_rgba(245,158,11,0.08),0_0_60px_rgba(245,158,11,0.03)] hover:border-gold/65 hover:shadow-[0_0_30px_rgba(245,158,11,0.15),0_0_80px_rgba(245,158,11,0.05)]"
              : "bg-white/[0.03] light:bg-bg-card backdrop-blur-xl border border-accent/10 light:border-border hover:border-accent/30 light:hover:border-accent/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#6366f1]/8"
          }`}>
            {isPinned && (
              <div className="absolute top-0 left-0 right-0 h-full pointer-events-none"
                style={{background: "radial-gradient(ellipse at 30% 10%, rgba(245,158,11,0.06) 0%, transparent 60%)"}} />
            )}
            <div className="flex items-center justify-between mb-2 relative z-[1]">
              <div className="flex items-center gap-2">
                <div className="relative flex-shrink-0">
                {avatarUrls[review.username] ? (
                  <img src={avatarUrls[review.username]!} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <img src="/icons/default-avatar.png" alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                )}
                <div className="absolute -top-[8px] -left-[8px] w-[60px] h-[60px] pointer-events-none z-10">
                  <img src="/icons/avatar-frame-ornate.png?v=4" alt="" className="w-full h-full" />
                </div>
                </div>
                <span className="text-sm font-semibold text-text-primary hover:text-[#a5b4fc] cursor-pointer transition-colors" onClick={() => router.push(`/profile?username=${review.username}`)}>
                  {review.username}
                </span>
                {review.isPremium && <img src="/icons/premium-badge-20.png" alt="Golden Ticket" className="w-4 h-2.5 inline-block" />}
                {renderStars(review.rating)}
              </div>
              <span className="text-[11px] text-text-secondary">
                {formatDate(review.createdAt)}
              </span>
            </div>
            <p className="text-sm text-[#e0e0e0] light:text-text-primary leading-relaxed whitespace-pre-wrap relative z-[1]">
              {review.content}
            </p>
            <div className="flex items-center gap-2 mt-3 relative z-[1]">
              <button
                onClick={() => handleLike(review.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-sm font-semibold transition-all duration-200 border ${
                  review.liked
                    ? "text-[#f472b6] bg-[#ec4899]/10 border-[#ec4899]/20"
                    : "text-[#d1d5db] light:text-text-secondary bg-transparent border-white/10 light:border-border hover:bg-accent/10 hover:border-accent/20 hover:text-[#c7d2fe]"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                  fill={review.liked ? "#f472b6" : "none"}
                  stroke={review.liked ? "#f472b6" : "currentColor"}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78l1.06-1.06a5.5 5.5 0 0 0 0-7.78"/>
                </svg>
                <span>{review.likes || 0}</span>
              </button>
              <button
                onClick={() => toggleComments(review.id, review.username)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-sm font-semibold transition-all duration-200 border ${
                  expandedComments.has(review.id)
                    ? "text-[#c7d2fe] bg-accent/10 border-accent/20"
                    : "text-[#d1d5db] light:text-text-secondary bg-transparent border-white/10 light:border-border hover:bg-accent/10 hover:border-accent/20 hover:text-[#c7d2fe]"
                }`}
              >
                <span>💬</span>
                <span>{review.commentCount || "Comment"}</span>
              </button>
              {/* Report button with reason dropdown */}
              {authUser?.user_metadata?.username !== review.username && (
                <div className="relative inline-block">
                  <button
                    onClick={() => setReportPopover(reportPopover === review.id ? null : review.id)}
                    disabled={reportingReview.has(review.id)}
                    className={`flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
                      (reportCounts[review.id] || 0) > 0
                        ? "text-green-400"
                        : "text-text-secondary hover:text-red-400"
                    }`}
                    title={reportCounts[review.id] ? "Reported ✓" : "Report this review"}
                  >
                    {reportCounts[review.id] ? "✓ Reported" : (
                      <span><img src="/report-button.png?v=2" alt="Report" className="h-6 w-auto" /></span>
                    )}
                  </button>
                  {reportPopover === review.id && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-bg-card border border-border rounded-lg shadow-xl py-1 min-w-[140px]">
                      {["inappropriate","spam","obscenity","hate_speech","spoiler","other"].map((r) => (
                        <button key={r}
                          onClick={() => { handleReport("review", review.id, r); setReportPopover(null); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors">
                          {r === "inappropriate" ? "👎 Inappropriate" : r === "spam" ? "📢 Spam" : r === "obscenity" ? "🔞 Obscenity" : r === "hate_speech" ? "🗣️ Hate Speech" : r === "spoiler" ? "🚨 Spoiler" : "··· Other"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Delete own review */}
              {authUser?.user_metadata?.username === review.username && (
                confirmDeleteId === review.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      disabled={deletingId === review.id}
                      className="text-[10px] px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
                    >
                      {deletingId === review.id ? "⏳" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[10px] text-text-secondary hover:text-white light:hover:text-accent"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(review.id)}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-red-400 transition-colors"
                    title="Delete your review"
                  >
                    🗑️
                  </button>
                )
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
              {isPinned && (
                <span className="ml-auto text-[11px] font-semibold text-[#fbbf24] flex items-center gap-1">📌 Top Review</span>
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
              <div className="mt-3 pt-3 border-t border-border">
                {loadingComments.has(review.id) ? (
                  <p className="text-xs text-text-secondary">Loading comments...</p>
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
                    reportCounts={reportCounts}
                  />
                ) : (
                  <p className="text-xs text-text-secondary mb-3">No comments yet</p>
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
                      className="flex-1 bg-bg-surface text-text-primary text-xs rounded-lg px-3 py-2 outline-none border border-transparent focus:border-accent transition-colors placeholder:text-text-secondary"
                    />
                    <button
                      onClick={() => submitComment(review.id, review.username, tmdbId, "")}
                      disabled={!commentInputs[review.id]?.trim()}
                      className="px-3 py-1.5 bg-accent hover:bg-[#5558e6] disabled:opacity-40 text-text-primary light:text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
                    >
                      Post
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">
                    <a href="/signup" className="text-accent hover:underline">Sign in</a> to comment
                  </p>
                )}
              </div>
            )}
          </div>
        );

        return (
          <>
            {/* Top Review section — page 1 only */}
            {pinnedReviews.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-[#fbbf24]">📌 Top Review</span>
                  <span className="text-[11px] text-text-secondary">Most liked reviews</span>
                </div>
                <div className="space-y-3">
                  {pinnedReviews.map((review) => <ReviewCard key={"pinned-" + review.id} review={review} isPinned={true} />)}
                </div>
              </div>
            )}

            {/* All reviews — chronological */}
            {pinnedReviews.length > 0 && (
              <div className="flex items-center gap-2 mb-2 mt-4 pt-4 border-t border-border">
                <span className="text-sm font-semibold text-[#d1d5db] light:text-text-primary">All Reviews</span>
                <span className="text-[11px] text-text-secondary">{totalReviews} total</span>
              </div>
            )}
            <div className="space-y-3">
              {allByTime.map((review) => <ReviewCard key={review.id} review={review} />)}
            </div>
          </>
        );
      })()}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1 flex-wrap">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 text-xs rounded bg-bg-card text-text-secondary hover:text-white light:hover:text-accent disabled:opacity-30 transition-colors"
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((item, i) =>
              item === "..." ? (
                <span key={`dots-${i}`} className="px-1 text-[10px] text-text-secondary">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => goToPage(item as number)}
                  className={`w-7 h-7 text-xs rounded-full transition-colors ${
                    currentPage === item
                      ? "bg-accent text-white"
                      : "bg-bg-card text-text-secondary hover:text-white light:hover:text-accent"
                  }`}
                >
                  {item}
                </button>
              )
            )}
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 text-xs rounded bg-bg-card text-text-secondary hover:text-white light:hover:text-accent disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
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
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", margin: 0 }}>Rating</p>
      <p style={{ fontSize: 34, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1, margin: 0 }}>
        {average > 0 ? average.toFixed(1) : "—"}
      </p>

      {/* Total reviews */}
      <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, marginBottom: 0 }}>Total reviews</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
        {total >= 10000 ? `${(total / 10000).toFixed(1)}M` : total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total)}
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
            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
              {star % 1 === 0 ? star : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
