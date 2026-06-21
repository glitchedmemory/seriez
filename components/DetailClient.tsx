"use client";

import { useState, useRef, useEffect } from "react";
import type { TmdbDetail } from "@/lib/tmdb";
import { ReviewSection } from "@/components/ReviewSection";
import { StarInput } from "@/components/StarInput";
import { createClient } from "@/lib/supabase/client";
import PosterImage from "@/components/PosterImage";

// ─── Inline SVG icon components ───
function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={active ? "#14b8a6" : "none"} stroke={active ? "#14b8a6" : "var(--color-text-secondary)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78l1.06-1.06a5.5 5.5 0 0 0 0-7.78"/>
    </svg>
  );
}

function PlayIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={active ? "#14b8a6" : "none"} stroke={active ? "#14b8a6" : "var(--color-text-secondary)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function CheckIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#14b8a6" : "var(--color-text-secondary)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
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
  const [showAllDirectors, setShowAllDirectors] = useState(false);
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
  const [noteText, setNoteText] = useState("");
  const [activeNoteCollId, setActiveNoteCollId] = useState<string | null>(null);
  const [activeNoteCollName, setActiveNoteCollName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const visibleCast = showAllCast ? detail.cast : detail.cast.slice(0, 6);
  const directors = detail.cast.filter((c: { character: string }) => c.character === "Director");
  const visibleDirectors = showAllDirectors ? directors : directors.slice(0, 5);
  const actors = detail.cast.filter((c: { character: string }) => c.character !== "Director");
  const visibleActors = showAllCast ? actors : actors.slice(0, 6);

  // Fetch current tracking status + collections on mount
  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      const uname = session?.user?.user_metadata?.username || localStorage.getItem("seriez-username");
      if (!uname) return;
      const username = uname;

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
    }).catch(() => {});
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

  async function addToCollection(listId: string, listName: string, note: string) {
    if (!authUser) return;
    if (!note.trim()) return;
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
    setTimeout(() => setCollFeedback(null), 3500);
  }

  function handleRatingChange(newRating: number) {
    setRating(newRating);
    if (trackStatus === "completed" && newRating > 0) {
      handleTrack("completed", newRating);
    }
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Backdrop — fallback to blurred poster when no backdrop */}
      {(detail.backdrop || detail.poster) && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden">
          <PosterImage
            src={(detail.backdrop || detail.poster)!.replace("w342", "w1280")}
            alt=""
            fill
            priority
            unoptimized
            className={!detail.backdrop ? "blur-2xl scale-125 opacity-50" : ""}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-[#0f0f1a]/60 to-transparent" />
        </div>
      )}

      <div className={`relative px-4 md:px-0 z-10 ${(detail.backdrop || detail.poster) ? '-mt-20 md:-mt-32' : ''}`}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="flex-shrink-0 w-36 md:w-48 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-card shadow-2xl relative">
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
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-tight">
              {detail.title}
            </h1>
            {detail.tagline && (
              <p className="text-sm text-text-secondary italic mt-1">
                &ldquo;{detail.tagline}&rdquo;
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3 text-xs text-text-secondary">
              <span className="bg-bg-card px-2 py-0.5 rounded-full">
                {detail.year}
              </span>
              <span className="bg-bg-card px-2 py-0.5 rounded-full uppercase">
                {detail.type}
              </span>
              {detail.runtime > 0 && (
                <span className="bg-bg-card px-2 py-0.5 rounded-full">
                  {formatRuntime(detail.runtime)}
                </span>
              )}
              <span className="bg-bg-card px-2 py-0.5 rounded-full">
                {detail.status}
              </span>
              {detail.type === "tv" && detail.seasons && (
                <span className="bg-bg-card px-2 py-0.5 rounded-full">
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
                  className="text-[11px] px-2.5 py-1 rounded-full bg-bg-card text-accent-light border border-accent/30"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Star rating — only when Watched */}
            {authUser && isWatched && (
              <div className="flex justify-center md:justify-start mt-2">
                <StarInput value={rating} onChange={handleRatingChange} />
              </div>
            )}
            {isWatched && trackedAt && (
              <p className="text-[10px] text-text-secondary mt-1 text-center md:text-left">
                Watched {formatDate(trackedAt)}
              </p>
            )}

            {/* Tracking buttons */}
            {!mounted ? null : (
              <>
                {!authUser ? (
                  <div className="mt-4 text-center md:text-left">
                    <a href="/signup" className="inline-block px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-[#818cf8] transition-colors">
                      Sign in to track
                    </a>
                    <p className="text-[11px] text-text-secondary mt-1">
                      <a href="/login" className="text-accent hover:underline">Sign in</a> to save your watch history
                    </p>
                  </div>
                ) : (
            <div className="flex gap-2 mt-4 justify-center md:justify-start">
              <button
                onClick={() => handleTrack("plan_to_watch")}
                disabled={trackLoading}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all"
                style={{
                  color: isWanted ? "#14b8a6" : "var(--color-text-secondary)",
                  backgroundColor: isWanted ? "#14b8a610" : "var(--bg-card)",
                  border: isWanted ? "1px solid #14b8a640" : "1px solid var(--border-color)",
                }}
              >
                <HeartIcon active={isWanted} />
                TO WATCH
              </button>
              <button
                onClick={() => handleTrack("watching")}
                disabled={trackLoading || (detail.daysUntil != null && detail.daysUntil > 0)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all"
                style={{
                  color: isWatching ? "#14b8a6" : "var(--color-text-secondary)",
                  backgroundColor: isWatching ? "#14b8a610" : "var(--bg-card)",
                  border: isWatching ? "1px solid #14b8a640" : "1px solid var(--border-color)",
                }}
              >
                <PlayIcon active={isWatching} />
                WATCHING
              </button>
              <button
                onClick={() => handleTrack("completed")}
                disabled={trackLoading || (detail.daysUntil != null && detail.daysUntil > 0)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all"
                style={{
                  color: isWatched ? "#14b8a6" : "var(--color-text-secondary)",
                  backgroundColor: isWatched ? "#14b8a610" : "var(--bg-card)",
                  border: isWatched ? "1px solid #14b8a640" : "1px solid var(--border-color)",
                }}
              >
                <CheckIcon active={isWatched} />
                WATCHED
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
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-border bg-bg-card text-text-secondary hover:text-text-primary hover:border-accent"
                >
                  <span className="text-sm font-bold mr-0.5">+</span>
                  Add to Collection
                </button>
                {collFeedback && (
                  <span className={`text-[12px] font-medium ml-2 self-center px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                    collFeedback.includes("✓") ? "bg-green-500/15 text-green-400" :
                    collFeedback.includes("Failed") ? "bg-red-500/15 text-red-400" :
                    "text-accent"
                  }`}>{collFeedback}</span>
                )}
                {showCollDropdown && (
                  <div className="absolute mt-8 w-52 bg-bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                    {activeNoteCollId ? (
                      <div className="p-2.5">
                        <button
                          onClick={() => { setActiveNoteCollId(null); setActiveNoteCollName(""); setNoteText(""); }}
                          className="text-[10px] text-text-secondary hover:text-text-primary mb-2 border-none bg-transparent cursor-pointer"
                        >
                          ← Back
                        </button>
                        <p className="text-[11px] text-text-secondary mb-1.5">Your thought</p>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="e.g. Best action movie of 2025"
                            className="flex-1 px-2 py-1.5 text-xs bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-secondary outline-none focus:border-accent"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && noteText.trim()) {
                                addToCollection(activeNoteCollId, activeNoteCollName, noteText.trim());
                                setNoteText("");
                                setActiveNoteCollId(null);
                                setActiveNoteCollName("");
                                setShowCollDropdown(false);
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              if (noteText.trim()) {
                                addToCollection(activeNoteCollId, activeNoteCollName, noteText.trim());
                                setNoteText("");
                                setActiveNoteCollId(null);
                                setActiveNoteCollName("");
                                setShowCollDropdown(false);
                              }
                            }}
                            disabled={!noteText.trim() || addingCollId !== null}
                            className="px-2.5 py-1.5 text-xs bg-accent text-white rounded-lg font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors border-none cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ) : collections.length === 0 ? (
                      <div className="px-3 py-3 text-[11px] text-text-secondary text-center">
                        No collections yet.
                        <a href="/library?tab=collections" className="block mt-1 text-accent hover:underline">Create one →</a>
                      </div>
                    ) : (
                      collections.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setActiveNoteCollId(c.id); setActiveNoteCollName(c.name); }}
                          disabled={addingCollId === c.id}
                          className="w-full text-left px-3 py-2.5 text-xs text-text-primary hover:bg-bg-surface flex justify-between items-center transition-colors disabled:opacity-50 border-none cursor-pointer"
                        >
                          <span>{c.name}</span>
                          <span className="text-[10px] text-text-secondary">{c.itemCount}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Extra info */}
            <div className="mt-3 text-xs text-text-secondary space-y-0.5">
              {detail.type === "movie" && detail.director && (
                <p>
                  Director:{" "}
                  <span className="text-text-secondary">{detail.director}</span>
                </p>
              )}
              {detail.type === "tv" && detail.createdBy && (
                <p>
                  Created by:{" "}
                  <span className="text-text-secondary">
                    {detail.createdBy.join(", ")}
                  </span>
                </p>
              )}
              {detail.type === "tv" && detail.networks && (
                <p>
                  Network:{" "}
                  <span className="text-text-secondary">
                    {detail.networks.join(", ")}
                  </span>
                </p>
              )}
              {detail.type === "movie" && detail.budget ? (
                <p>
                  Budget:{" "}
                  <span className="text-text-secondary">
                    {formatCurrency(detail.budget)}
                  </span>
                  {detail.revenue ? (
                    <>
                      {" "}
                      · Revenue:{" "}
                      <span className="text-text-secondary">
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
            <h2 className="text-lg font-semibold text-text-primary mb-2">Overview</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              {detail.overview}
            </p>
          </section>
        )}

        {/* Reviews */}
        <section className="mt-6">
          <ReviewSection tmdbId={detail.id} mediaType={detail.type} trackStatus={trackStatus} trackVersion={trackVersion} trackRating={rating} authUser={authUser} />
        </section>

        {/* Trailers */}
        {detail.videos.length > 0 && (
          <section id="trailers" className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">
              🎬 Trailers
            </h2>
            <div className="space-y-3">
              {detail.videos.slice(0, 3).map((v) => (
                <div key={v.key} className="aspect-video rounded-xl overflow-hidden bg-bg-card">
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

        {/* Directors */}
        {directors.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Director{directors.length > 1 ? "s" : ""}</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {visibleDirectors.map((c: any) => (
                <a
                  key={c.name}
                  href={`/person/${c.id}`}
                  className="bg-bg-card rounded-xl p-2 text-center hover:bg-bg-surface transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-bg-surface mb-2 relative">
                    <PosterImage
                      src={c.photo}
                      alt={c.name}
                      fill
                      className="rounded-full"
                      sizes="(max-width: 768px) 48px, 64px"
                    />
                  </div>
                  <p className="text-xs font-medium text-text-primary truncate">
                    {c.name}
                  </p>
                  <p className="text-[10px] text-text-secondary truncate">
                    Director
                  </p>
                </a>
              ))}
            </div>
            {directors.length > 5 && (
              <button
                onClick={() => setShowAllDirectors(!showAllDirectors)}
                className="mt-3 text-xs text-accent hover:underline mx-auto block"
              >
                {showAllDirectors ? "Show less" : `Show all ${directors.length} directors`}
              </button>
            )}
          </section>
        )}

        {/* Cast */}
        {actors.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Cast</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {visibleActors.map((c: any) => (
                <a
                  key={c.name}
                  href={`/person/${c.id}`}
                  className="bg-bg-card rounded-xl p-2 text-center hover:bg-bg-surface transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-bg-surface mb-2 relative">
                    <PosterImage
                      src={c.photo}
                      alt={c.name}
                      fill
                      className="rounded-full"
                      sizes="(max-width: 768px) 48px, 64px"
                    />
                  </div>
                  <p className="text-xs font-medium text-text-primary truncate">
                    {c.name}
                  </p>
                  <p className="text-[10px] text-text-secondary truncate">
                    {c.character}
                  </p>
                </a>
              ))}
            </div>
            {actors.length > 6 && (
              <button
                onClick={() => setShowAllCast(!showAllCast)}
                className="mt-3 text-xs text-accent hover:underline mx-auto block"
              >
                {showAllCast ? "Show less" : `Show all ${actors.length} cast members`}
              </button>
            )}
          </section>
        )}

        {/* Recommended */}
        <SimilarSection items={detail.similar} />
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
        <h2 className="text-lg font-semibold text-text-primary">Recommended</h2>
        <div className="hidden md:flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="w-8 h-8 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-text-primary text-sm transition-colors"
          >
            ←
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-8 h-8 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-text-primary text-sm transition-colors"
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
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-bg-card group-hover:scale-105 transition-transform relative">
              <PosterImage
                src={item.poster}
                alt={item.title}
                fill
                className="rounded-lg"
                sizes="112px"
              />
            </div>
            <p className="text-[11px] text-text-primary mt-1 line-clamp-1">
              {item.title}
            </p>
            <p className="text-[10px] text-text-secondary">
              ★ {item.rating}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
