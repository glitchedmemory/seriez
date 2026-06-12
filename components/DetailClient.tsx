"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import type { TmdbDetail } from "@/lib/tmdb";
import { ReviewSection } from "@/components/ReviewSection";
import { StarInput } from "@/components/StarInput";
import { createClient } from "@/lib/supabase/client";
import PosterImage from "@/components/PosterImage";

// ─── Inline SVG icon components (Feather icons) ───
function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={active ? "text-pink-500" : "text-gray-400"}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78l1.06-1.06a5.5 5.5 0 0 0 0-7.78"/>
    </svg>
  );
}

function WatchingIcon({ active }: { active: boolean }) {
  return (
    <Image
      src={active ? "/icons/watching-pink.png" : "/icons/watching-gray.png"}
      alt="Watching"
      width={20}
      height={20}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function WatchedIcon({ active }: { active: boolean }) {
  return (
    <Image
      src={active ? "/icons/watched-pink.png" : "/icons/watched-gray.png"}
      alt="Watched"
      width={20}
      height={20}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function formatCurrency(n: number) {
  if (n === 0) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatRuntime(minutes: number) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function DetailClient({ detail }: { detail: TmdbDetail }) {
  const [showAllCast, setShowAllCast] = useState(false);
  const [trackStatus, setTrackStatus] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [trackVersion, setTrackVersion] = useState(0);
  const [trackedAt, setTrackedAt] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authUser, setAuthUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const supabase = createClient();

  // Collections
  const [collections, setCollections] = useState<{ id: string; name: string; itemCount: number }[]>([]);
  const [showCollDropdown, setShowCollDropdown] = useState(false);
  const [addingCollId, setAddingCollId] = useState<string | null>(null);
  const [collFeedback, setCollFeedback] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const visibleCast = showAllCast ? detail.cast : detail.cast.slice(0, 6);

  // Fetch current tracking status + collections on mount
  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => setAuthUser(session?.user ?? null)).catch(() => {});
    const username = localStorage.getItem("seriez-username") || "";

    // Track status
    fetch(`/api/track?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const match = data.find(
            (t: { tmdbId: number; mediaType: string }) =>
              t.tmdbId === detail.id && t.mediaType === detail.type
          );
          if (match) {
            setTrackStatus(match.status);
            setRating(match.rating || 0);
            setTrackedAt(match.updatedAt || null);
          }
        }
      })
      .catch(() => {});

    // Collections
    fetch(`/api/collections?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.collections) setCollections(data.collections);
      })
      .catch(() => {});
  }, [detail.id, detail.type]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCollDropdown(false);
      }
    }
    if (showCollDropdown) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCollDropdown]);

  async function handleTrack(status: string, ratingOverride?: number) {
    if (!authUser) return; // Require authentication
    const username = authUser.user_metadata?.username || "";
    const effectiveRating = ratingOverride ?? rating;
    // Already completed → re-submit with updated rating instead of toggling off
    const isResubmit = status === "completed" && trackStatus === "completed" && ratingOverride !== undefined;
    const newStatus = isResubmit ? "completed" : (trackStatus === status ? null : status);

    setTrackLoading(true);
    try {
      if (newStatus) {
        const body: Record<string, unknown> = {
          username,
          tmdbId: detail.id,
          mediaType: detail.type,
          status: newStatus,
        };
        if (status === "completed" && effectiveRating > 0) {
          body.rating = effectiveRating;
        }
        const res = await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        setTrackedAt(json.updatedAt || new Date().toISOString());
      } else {
        await fetch("/api/track", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            tmdbId: detail.id,
            mediaType: detail.type,
          }),
        });
        setTrackedAt(null);
      }
      setTrackStatus(newStatus);
      setTrackVersion(v => v + 1);
    } catch {}
    setTrackLoading(false);
  }

  // Map trackStatus to active states
  const isWanted = trackStatus === "plan_to_watch";
  const isWatching = trackStatus === "watching";
  const isWatched = trackStatus === "completed";

  async function addToCollection(listId: string, listName: string) {
    if (!authUser) return;
    const note = prompt("One-line note (required):");
    if (!note || !note.trim()) return;
    const username = authUser.user_metadata?.username || "";
    setAddingCollId(listId);
    setCollFeedback(null);
    try {
      const res = await fetch(`/api/collections/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: detail.id, mediaType: detail.type, note: note.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setCollFeedback(`Added to "${listName}" ✓`);
        setCollections(prev => prev.map(c => c.id === listId ? { ...c, itemCount: c.itemCount + 1 } : c));
      } else {
        setCollFeedback(json.error || "Failed to add");
      }
    } catch {
      setCollFeedback("Failed to add");
    }
    setAddingCollId(null);
    setTimeout(() => setCollFeedback(null), 2500);
  }

  function handleRatingChange(newRating: number) {
    setRating(newRating);
    if (trackStatus === "completed" && newRating > 0) {
      handleTrack("completed", newRating);
    }
  }

  return (
    <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
      {/* Backdrop — fallback to blurred poster when no backdrop */}
      {(detail.backdrop || detail.poster) && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden">
          <PosterImage
            src={(detail.backdrop || detail.poster)!.replace("w342", "w780")}
            alt=""
            fill
            priority
            className={!detail.backdrop ? "blur-2xl scale-125 opacity-50" : ""}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-[#0f0f1a]/60 to-transparent" />
        </div>
      )}

      <div className={`relative px-4 md:px-0 z-10 ${(detail.backdrop || detail.poster) ? '-mt-20 md:-mt-32' : ''}`}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="flex-shrink-0 w-36 md:w-48 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#1a1a2e] shadow-2xl relative">
              <PosterImage
                src={detail.poster}
                alt={detail.title}
                fill
                className="rounded-xl"
                sizes="(max-width: 768px) 144px, 192px"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
              {detail.title}
            </h1>
            {detail.tagline && (
              <p className="text-sm text-[#9ca3af] italic mt-1">
                &ldquo;{detail.tagline}&rdquo;
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3 text-xs text-[#9ca3af]">
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
                {detail.year}
              </span>
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full uppercase">
                {detail.type}
              </span>
              {detail.runtime > 0 && (
                <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
                  {formatRuntime(detail.runtime)}
                </span>
              )}
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
                {detail.status}
              </span>
              {detail.type === "tv" && detail.seasons && (
                <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
                  {detail.seasons} Season{detail.seasons > 1 ? "s" : ""}
                  {detail.episodes ? ` · ${detail.episodes} Ep` : ""}
                </span>
              )}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center md:justify-start">
              {detail.genres.map((g) => (
                <span
                  key={g}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-[#1a1a2e] text-[#c4b5fd] border border-[#6366f1]/30"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Star rating — available for all signed-in users */}
            {authUser && (
              <div className="flex justify-center md:justify-start mt-2">
                <StarInput value={rating} onChange={handleRatingChange} />
              </div>
            )}
            {isWatched && trackedAt && (
              <p className="text-[10px] text-[#6b7280] mt-1 text-center md:text-left">
                Watched {formatDate(trackedAt)}
              </p>
            )}

            {/* Tracking buttons */}
            {!mounted ? null : (
              <>
                {!authUser ? (
                  <div className="mt-4 text-center md:text-left">
                    <a href="/signup" className="inline-block px-4 py-2 rounded-lg bg-[#6366f1] text-white text-sm font-medium hover:bg-[#818cf8] transition-colors">
                      Sign in to track
                    </a>
                    <p className="text-[11px] text-[#6b7280] mt-1">
                      <a href="/login" className="text-[#6366f1] hover:underline">Sign in</a> to save your watch history
                    </p>
                  </div>
                ) : (
            <div className="flex gap-1 mt-4 justify-center md:justify-start">
              <button
                onClick={() => handleTrack("plan_to_watch")}
                disabled={trackLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                style={{
                  color: isWanted ? "#ec4899" : "#9ca3af",
                  borderColor: isWanted ? "#ec489950" : "#2d2d4a",
                  backgroundColor: isWanted ? "#ec489910" : "#1a1a2e",
                }}
              >
                <HeartIcon active={isWanted} />
                To Watch
              </button>
              <button
                onClick={() => handleTrack("watching")}
                disabled={trackLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                style={{
                  color: isWatching ? "#ec4899" : "#9ca3af",
                  borderColor: isWatching ? "#ec489950" : "#2d2d4a",
                  backgroundColor: isWatching ? "#ec489910" : "#1a1a2e",
                }}
              >
                <WatchingIcon active={isWatching} />
                Watching
              </button>
              <button
                onClick={() => handleTrack("completed")}
                disabled={trackLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                style={{
                  color: isWatched ? "#ec4899" : "#9ca3af",
                  borderColor: isWatched ? "#ec489950" : "#2d2d4a",
                  backgroundColor: isWatched ? "#ec489910" : "#1a1a2e",
                }}
              >
                <WatchedIcon active={isWatched} />
                Watched
              </button>
            </div>
            )}
            </>
            )}

            {/* Add to Collection */}
            {mounted && (
              <div className="flex justify-center md:justify-start mt-2 relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowCollDropdown(!showCollDropdown)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-[#2d2d4a] bg-[#1a1a2e] text-[#9ca3af] hover:text-white hover:border-[#6366f1]"
                >
                  <span className="text-sm font-bold mr-0.5">+</span>
                  Add to Collection
                </button>
                {collFeedback && (
                  <span className="text-[11px] ml-2 self-center text-[#6366f1]">{collFeedback}</span>
                )}
                {showCollDropdown && (
                  <div className="absolute mt-8 w-52 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl shadow-2xl z-50 overflow-hidden">
                    {collections.length === 0 ? (
                      <div className="px-3 py-3 text-[11px] text-[#6b7280] text-center">
                        No collections yet.
                        <a href="/library?tab=collections" className="block mt-1 text-[#6366f1] hover:underline">Create one →</a>
                      </div>
                    ) : (
                      collections.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { addToCollection(c.id, c.name); setShowCollDropdown(false); }}
                          disabled={addingCollId === c.id}
                          className="w-full text-left px-3 py-2.5 text-xs text-white hover:bg-[#25253a] flex justify-between items-center transition-colors disabled:opacity-50"
                        >
                          <span>{c.name}</span>
                          <span className="text-[10px] text-[#6b7280]">{c.itemCount}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Extra info */}
            <div className="mt-3 text-xs text-[#6b7280] space-y-0.5">
              {detail.type === "movie" && detail.director && (
                <p>
                  Director:{" "}
                  <span className="text-[#9ca3af]">{detail.director}</span>
                </p>
              )}
              {detail.type === "tv" && detail.createdBy && (
                <p>
                  Created by:{" "}
                  <span className="text-[#9ca3af]">
                    {detail.createdBy.join(", ")}
                  </span>
                </p>
              )}
              {detail.type === "tv" && detail.networks && (
                <p>
                  Network:{" "}
                  <span className="text-[#9ca3af]">
                    {detail.networks.join(", ")}
                  </span>
                </p>
              )}
              {detail.type === "movie" && detail.budget ? (
                <p>
                  Budget:{" "}
                  <span className="text-[#9ca3af]">
                    {formatCurrency(detail.budget)}
                  </span>
                  {detail.revenue ? (
                    <>
                      {" "}
                      · Revenue:{" "}
                      <span className="text-[#9ca3af]">
                        {formatCurrency(detail.revenue)}
                      </span>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Overview */}
        {detail.overview && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-2">Overview</h2>
            <p className="text-sm text-[#d1d5db] leading-relaxed">
              {detail.overview}
            </p>
          </section>
        )}

        {/* Trailers */}
        {detail.videos.length > 0 && (
          <section id="trailers" className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3">
              🎬 Trailers
            </h2>
            <div className="space-y-3">
              {detail.videos.slice(0, 3).map((v) => (
                <div key={v.key} className="aspect-video rounded-xl overflow-hidden bg-[#1a1a2e]">
                  <iframe
                    src={`https://www.youtube.com/embed/${v.key}`}
                    title={v.name}
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cast */}
        {detail.cast.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3">Cast</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {visibleCast.map((c) => (
                <a
                  key={c.name}
                  href={`/person/${c.id}`}
                  className="bg-[#1a1a2e] rounded-xl p-2 text-center hover:bg-[#25253a] transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-[#25253a] mb-2 relative">
                    <PosterImage
                      src={c.photo}
                      alt={c.name}
                      fill
                      className="rounded-full"
                      sizes="(max-width: 768px) 48px, 64px"
                    />
                  </div>
                  <p className="text-xs font-medium text-white truncate">
                    {c.name}
                  </p>
                  <p className="text-[10px] text-[#6b7280] truncate">
                    {c.character}
                  </p>
                </a>
              ))}
            </div>
            {detail.cast.length > 6 && (
              <button
                onClick={() => setShowAllCast(!showAllCast)}
                className="mt-3 text-xs text-[#6366f1] hover:underline mx-auto block"
              >
                {showAllCast ? "Show less" : `Show all ${detail.cast.length} cast members`}
              </button>
            )}
          </section>
        )}

        {/* Recommended */}
        <SimilarSection items={detail.similar} />

        {/* Reviews */}
        <section className="mt-6">
          <ReviewSection tmdbId={detail.id} mediaType={detail.type} trackStatus={trackStatus} trackVersion={trackVersion} trackRating={rating} authUser={authUser} />
        </section>
      </div>
    </div>
  );
}

function SimilarSection({ items }: { items: TmdbDetail["similar"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Recommended</h2>
        <div className="hidden md:flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="w-8 h-8 rounded-full bg-[#1a1a2e] hover:bg-[#25253a] flex items-center justify-center text-white text-sm transition-colors"
          >
            ←
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-8 h-8 rounded-full bg-[#1a1a2e] hover:bg-[#25253a] flex items-center justify-center text-white text-sm transition-colors"
          >
            →
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar scroll-smooth"
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={`/title/${item.id}?type=${item.type}`}
            className="flex-shrink-0 w-28 group"
          >
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a2e] group-hover:scale-105 transition-transform relative">
              <PosterImage
                src={item.poster}
                alt={item.title}
                fill
                className="rounded-lg"
                sizes="112px"
              />
            </div>
            <p className="text-[11px] text-white mt-1 line-clamp-1">
              {item.title}
            </p>
            <p className="text-[10px] text-[#6b7280]">
              ★ {item.rating}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
