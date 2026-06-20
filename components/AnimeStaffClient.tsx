"use client";

import { useState, useEffect } from "react";
import type { StaffDetail } from "@/lib/anilist";
import PosterImage from "@/components/PosterImage";
import { createClient } from "@/lib/supabase/client";

function CreditCard({ item }: { item: { id: number; title: string; format: string; poster: string | null; rating: number } }) {
  return (
    <a
      href={`/title/${item.id}?type=anime`}
      className="flex items-center gap-3 bg-bg-card rounded-xl p-3 hover:bg-bg-surface transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-[60px] rounded-lg overflow-hidden bg-bg-primary relative">
        <PosterImage
          src={item.poster}
          alt={item.title}
          fill
          className="rounded-lg"
          sizes="40px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
        <p className="text-xs text-text-secondary">{item.format}</p>
      </div>
      {item.rating > 0 && (
        <div className="text-xs text-gold">★ {item.rating}</div>
      )}
    </a>
  );
}

export default function AnimeStaffClient({ staff }: { staff: StaffDetail }) {
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
    fetch(`/api/persons/like-count?source=anilist&id=${staff.id}`)
      .then(r => r.json())
      .then(d => setLikeCount(d.count || 0))
      .catch(() => {});
    if (user) {
      const username = localStorage.getItem("seriez-username") || user.user_metadata?.username;
      if (username) {
        fetch(`/api/persons/likes?username=${encodeURIComponent(username)}`)
          .then(r => r.json())
          .then(d => {
            const liked = (d.likes || []).some(
              (l: any) => l.person_source === "anilist" && l.person_id === staff.id
            );
            setLiked(liked);
          })
          .catch(() => {});
      }
    }
  }, [staff.id, user]);

  const handleLike = async () => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const kf = (staff.knownFor || "").toLowerCase();
      const personRole = kf.includes("act") && kf.includes("direct") ? "both" : kf.includes("direct") ? "director" : "actor";
      const res = await fetch("/api/persons/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          personSource: "anilist",
          personId: staff.id,
          personName: staff.name,
          personImage: staff.photo,
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
    <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 pt-8">
        {/* Photo */}
        <div className="flex-shrink-0 w-32 h-32 md:w-48 md:h-48 mx-auto md:mx-0">
          <div className="w-full h-full rounded-2xl overflow-hidden bg-bg-card relative">
            <PosterImage
              src={staff.photo}
              alt={staff.name}
              fill
              className="rounded-2xl"
              sizes="(max-width: 768px) 128px, 192px"
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
            {staff.name}
          </h1>
          {staff.nativeName && (
            <p className="text-sm text-text-secondary mt-1">{staff.nativeName}</p>
          )}
          <p className="text-sm text-accent mt-1">{staff.knownFor}</p>

          {staff.birthday && (
            <p className="text-xs text-text-secondary mt-2">
              Born: {staff.birthday}
              {staff.birthplace ? ` · ${staff.birthplace}` : ""}
            </p>
          )}

          {/* Like button */}
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
        </div>
      </div>

      {/* Description */}
      {staff.description && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-text-primary mb-2">About</h2>
          <p className="text-sm text-[#d1d5db] light:text-text-primary leading-relaxed">
            {staff.description
              .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Markdown links → display text
              .replace(/\[\[?([^\]]+)\]\]?/g, '$1')    // [[text]] or [text] → text
              .replace(/<[^>]*>/g, '')                  // strip any leftover HTML tags
              .replace(/\n{2,}/g, '\n\n')               // normalize multiple newlines
              .trim()}
          </p>
        </section>
      )}

      {/* Credits */}
      {staff.credits.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-text-primary mb-3">
            🎬 Works ({staff.credits.length})
          </h2>
          <div className="space-y-2">
            {staff.credits.map((m, i) => (
              <CreditCard key={`credit-${m.id}-${i}`} item={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
