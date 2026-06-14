"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PosterImage from "@/components/PosterImage";

interface CollectionItem {
  tmdbId: number;
  mediaType: string;
  title: string;
  poster: string | null;
  year: string | null;
  rating: number;
  note: string | null;
  addedAt: string;
}

interface Comment {
  id: number;
  username: string;
  content: string;
  created_at: string;
}

export default function CollectionClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [collection, setCollection] = useState<any>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});

  // Detect auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user?.user_metadata?.username;
      setAuthUser(u || null);
    });
  }, []);

  // Load collection
  const loadCollection = useCallback(async () => {
    try {
      const res = await fetch(`/api/collections/${id}/items`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      setCollection(data);
      setItems(data.items || []);
      setLikesCount(data.likesCount || 0);
    } catch {
      setCollection(null);
    } finally {
      setLoading(false);
    }
  // Load comments
    fetch(`/api/collections/${id}/comments`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments || []))
      .catch(() => {});
    // Check if current user liked
    if (authUser) {
      supabase.from("collection_likes").select("id").eq("list_id", id).eq("username", authUser).single()
        .then(({ data }) => setLiked(!!data));
    }
  }, [id, authUser]);

  useEffect(() => { loadCollection(); }, [loadCollection]);

  // Fetch avatar URLs when comments change
  useEffect(() => {
    const usernames = [...new Set(comments.map((c) => c.username))];
    if (usernames.length === 0) return;
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=username,avatar_url&username=in.(${usernames.map((u) => encodeURIComponent(u)).join(",")})`;
    fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    })
      .then((r) => r.json())
      .then((rows: { username: string; avatar_url: string | null }[]) => {
        const map: Record<string, string | null> = {};
        rows.forEach(({ username, avatar_url }) => { map[username] = avatar_url; });
        usernames.forEach((u) => { if (!(u in map)) map[u] = null; });
        setAvatarUrls(map);
      })
      .catch(() => {});
  }, [comments]);

  // Like
  const handleLike = async () => {
    if (!authUser) return alert("Sign in to like");
    setLiked(!liked);
    setLikesCount((c: number) => liked ? c - 1 : c + 1);
    await fetch(`/api/collections/${id}/like`, { method: "POST" });
  };

  // Comment
  const handleComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/collections/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText.trim() }),
    });
    if (res.ok) {
      const { comment } = await res.json();
      setComments((prev) => [...prev, comment]);
      setCommentText("");
    } else {
      const { error } = await res.json();
      alert(error || "Failed to comment");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto min-h-screen px-4 py-6 pb-24">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-bg-card rounded" />
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map((i) => (
              <div key={i} className="aspect-[2/3] bg-bg-card rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="max-w-2xl mx-auto min-h-screen px-4 py-20 pb-24 text-center">
        <p className="text-4xl mb-4">📭</p>
        <h1 className="text-lg font-semibold text-white mb-2">Collection not found</h1>
        <button onClick={() => router.push("/search")} className="text-sm text-accent hover:underline">
          ← Back to Search
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto min-h-screen px-4 py-6 pb-24">
      {/* Header */}
      <button onClick={() => router.push("/search")} className="text-xs text-text-secondary hover:text-white mb-3 inline-block">
        ← Back to Search
      </button>

      <div className="relative">
        <h1 className="text-xl font-bold text-white pr-14 mb-1">{collection.name}</h1>
        <button onClick={handleLike} className={`absolute top-4 right-16 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${liked ? "bg-[#f87171]/20 text-[#f87171] shadow-[0_0_8px_rgba(248,113,113,0.25)]" : "bg-white/5 text-text-secondary hover:bg-white/10 hover:text-[#f87171] active:scale-95"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          {likesCount}
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-text-secondary mb-5">
        <span>by <span className="text-[#d1d5db]">{collection.owner}</span></span>
        <span>·</span>
        <span>{collection.itemCount} items</span>
      </div>

      {/* Items Grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-8">
          {items.map((item) => (
            <button
              key={`${item.tmdbId}-${item.mediaType}`}
              onClick={() => router.push(`/title/${item.tmdbId}?type=${item.mediaType}`)}
              className="bg-bg-card rounded-xl overflow-hidden text-left hover:ring-1 ring-accent transition-all group"
            >
              <div className="aspect-[2/3] bg-bg-surface overflow-hidden relative">
                {item.poster ? (
                  <PosterImage
                    src={item.poster}
                    alt={item.title}
                    width={200}
                    height={300}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 50vw, 200px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10 text-2xl">🎬</div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium text-white truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.year && <span className="text-[10px] text-text-secondary">{item.year}</span>}
                  {item.rating > 0 && (
                    <span className="text-[10px] text-gold">★ {item.rating}</span>
                  )}
                </div>
                {item.note && (
                  <p className="text-[10px] text-text-secondary italic mt-1 line-clamp-1">“{item.note}”</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-10 mb-8">
          <p className="text-3xl mb-2">📦</p>
          <p className="text-sm text-text-secondary">No items in this collection yet</p>
        </div>
      )}

      {/* Comments Section */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3">
          💬 Comments {comments.length > 0 && `(${comments.length})`}
        </h2>

        {/* Comment Input */}
        {authUser ? (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleComment(); }}}
              placeholder="Write a comment..."
              maxLength={200}
              className="flex-1 bg-bg-card text-white text-xs rounded-lg px-3 py-2 outline-none border border-transparent focus:border-accent transition-colors placeholder:text-text-secondary"
            />
            <button
              onClick={handleComment}
              disabled={!commentText.trim() || submitting}
              className="px-3 py-2 bg-accent hover:bg-[#5558e6] disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
            >
              Post
            </button>
          </div>
        ) : (
          <p className="text-xs text-text-secondary mb-4">
            <a href="/login" className="text-accent hover:underline">Sign in</a> to leave a comment
          </p>
        )}

        {/* Comment List */}
        {comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                {avatarUrls[c.username] ? (
                  <img src={avatarUrls[c.username]!} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center text-sm font-bold text-white flex-shrink-0 mt-0.5">
                    {c.username[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white hover:text-accent cursor-pointer transition-colors" onClick={() => router.push(`/profile?username=${c.username}`)}>{c.username}</span>
                    <span className="text-[10px] text-text-secondary">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-[#d1d5db] mt-0.5">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-secondary text-center py-4">No comments yet. Be the first!</p>
        )}
      </section>
    </div>
  );
}
