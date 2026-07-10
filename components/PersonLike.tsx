"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PersonLike({ personId, personName, personPhoto, personKnownFor }: {
  personId: number;
  personName: string;
  personPhoto: string | null;
  personKnownFor: string;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });
  }, []);

  useEffect(() => {
    fetch(`/api/persons/like-count?source=tmdb&id=${personId}`)
      .then(r => r.json())
      .then(d => setLikeCount(d.count || 0))
      .catch(() => {});
    if (user) {
      const username = user.user_metadata?.username || localStorage.getItem("seriez-username");
      if (username) {
        fetch(`/api/persons/likes?username=${encodeURIComponent(username)}`)
          .then(r => r.json())
          .then(d => {
            const liked = (d.likes || []).some(
              (l: any) => l.person_source === "tmdb" && l.person_id === personId
            );
            setLiked(liked);
          })
          .catch(() => {});
      }
    }
  }, [personId, user]);

  const handleLike = async () => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const kf = (personKnownFor || "").toLowerCase();
      const personRole = kf.includes("act") && kf.includes("direct") ? "both" : kf.includes("direct") ? "director" : "actor";
      const res = await fetch("/api/persons/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          personSource: "tmdb",
          personId,
          personName,
          personImage: personPhoto,
          personRole,
        }),
      });
      const data = await res.json();
      if (data.liked !== undefined) {
        setLiked(data.liked);
        setLikeCount(data.count);
      }
    } catch {}
  };

  return (
    <div className="mt-2">
      <button
        onClick={handleLike}
        disabled={!user}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-base transition-colors ${
          liked
            ? "bg-red-500/10 border-red-500/30 text-red-500"
            : "bg-bg-card border-border text-text-secondary hover:border-red-500/30 hover:text-red-500"
        } ${!user ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        title={user ? (liked ? "Unlike" : "Like") : "Sign in to like"}
      >
        <span>{liked ? "❤️" : "🤍"}</span>
        <span className="text-sm font-medium">{likeCount}</span>
      </button>
    </div>
  );
}
