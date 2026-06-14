"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ReviewSection } from "@/components/ReviewSection";
import { StarInput } from "@/components/StarInput";
import { createClient } from "@/lib/supabase/client";
import PosterImage from "@/components/PosterImage";

// ─── Inline SVG icon components ───
function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={active ? "#14b8a6" : "none"} stroke={active ? "#14b8a6" : "#6b7280"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78l1.06-1.06a5.5 5.5 0 0 0 0-7.78"/>
    </svg>
  );
}

function PlayIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={active ? "#14b8a6" : "none"} stroke={active ? "#14b8a6" : "#6b7280"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function CheckIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#14b8a6" : "#6b7280"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

interface SeasonData {
  id: number;
  title: string;
  tagline: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  anilistBanner?: string | null;
  rating: number;
  voteCount: number;
  year: number;
  genres: string[];
  status: string;
  type: "tv";
  totalSeasons: number;
  totalEpisodes: number;
  createdBy?: string[];
  networks?: string[];
  lastAirDate?: string;
  cast: { id: number; name: string; character: string; photo: string | null }[];
  trailers: { key: string; name: string; site: string; type: string }[];
  similar: { id: number; title: string; poster: string | null; rating: number; year: number; type: "movie" | "tv" }[];
  seasonNumber: number;
  seasonName: string;
  seasonOverview: string;
  seasonPoster: string | null;
  seasonAirDate: string;
  episodes: {
    number: number;
    name: string;
    overview: string;
    still: string | null;
    rating: number;
    voteCount: number;
    airDate: string;
    runtime: number;
  }[];
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

export default function SeasonClient({ data }: { data: SeasonData }) {
  const [showAllCast, setShowAllCast] = useState(false);
  const [trackStatus, setTrackStatus] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [trackVersion, setTrackVersion] = useState(0);
  const [trackedAt, setTrackedAt] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
  const [epToggleLoading, setEpToggleLoading] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const supabase = createClient();
  const router = useRouter();

  // Episode pagination
  const [currentPage, setCurrentPage] = useState(1);
  const EPISODES_PER_PAGE = 30;

  // Collections
  const [collections, setCollections] = useState<{ id: string; name: string; itemCount: number }[]>([]);
  const [showCollDropdown, setShowCollDropdown] = useState(false);
  const [addingCollId, setAddingCollId] = useState<string | null>(null);
  const [collFeedback, setCollFeedback] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const visibleCast = showAllCast ? data.cast : data.cast.slice(0, 6);
  const totalEpPages = Math.ceil(data.episodes.length / EPISODES_PER_PAGE);
  const visibleEpisodes = data.episodes.slice((currentPage - 1) * EPISODES_PER_PAGE, currentPage * EPISODES_PER_PAGE);

  // Fetch current tracking status + watched episodes on mount
  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => setAuthUser(session?.user ?? null)).catch(() => {});
    const username = localStorage.getItem("seriez-username") || "";
    // Fetch tracking
    fetch(`/api/track?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((trackData) => {
        if (Array.isArray(trackData)) {
          const match = trackData.find(
            (t: { tmdbId: number; mediaType: string }) =>
              t.tmdbId === data.id && t.mediaType === "tv"
          );
          if (match) {
            setTrackStatus(match.status);
            setRating(match.rating || 0);
            setTrackedAt(match.updatedAt || null);
          }
        }
      })
      .catch(() => {});
    // Fetch watched episodes
    fetch(`/api/episodes?username=${encodeURIComponent(username)}&tmdbId=${data.id}`)
      .then((r) => r.json())
      .then((epData) => {
        if (epData.episodes) {
          const set = new Set<string>();
          epData.episodes.forEach((ep: { seasonNumber: number; episodeNumber: number }) => {
            set.add(`${ep.seasonNumber}-${ep.episodeNumber}`);
          });
          setWatchedEpisodes(set);
        }
      })
      .catch(() => {});

    // Collections
    fetch(`/api/collections?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((d) => { if (d.collections) setCollections(d.collections); })
      .catch(() => {});
  }, [data.id]);

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

  async function toggleEpisode(seasonNumber: number, episodeNumber: number) {
    if (!authUser) return;
    const key = `${seasonNumber}-${episodeNumber}`;
    const username = authUser.user_metadata?.username || "";
    const wasWatched = watchedEpisodes.has(key);

    // Optimistic episode update
    setWatchedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setEpToggleLoading(key);

    // Auto-manage tracking status
    const willHaveWatched = !wasWatched || watchedEpisodes.size > 1;
    if (willHaveWatched && !trackStatus) {
      // First episode checked → start watching
      setTrackStatus("watching");
      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: data.id, mediaType: "tv", status: "watching" }),
      });
    } else if (!willHaveWatched && trackStatus === "watching") {
      // All episodes unchecked → stop watching
      setTrackStatus(null);
      await fetch("/api/track", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: data.id, mediaType: "tv" }),
      });
    }

    try {
      await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: data.id, seasonNumber, episodeNumber }),
      });
    } catch {}
    setEpToggleLoading(null);
    // Was completed, now unchecking an episode → downgrade to watching
    if (trackStatus === "completed" && wasWatched && watchedEpisodes.size - 1 < data.episodes.length) {
      setTrackStatus("watching");
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: data.id, mediaType: "tv", status: "watching" }),
      }).catch(() => {});
    }
    // All episodes checked → auto-complete
    const nowAllWatched = !wasWatched && watchedEpisodes.size + 1 >= data.episodes.length;
    if (nowAllWatched && trackStatus !== "completed") {
      setTrackStatus("completed");
      setTrackedAt(new Date().toISOString());
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: data.id, mediaType: "tv", status: "completed" }),
      }).catch(() => {});
    }
  }

  const watchedCount = data.episodes.filter((ep) => watchedEpisodes.has(`${data.seasonNumber}-${ep.number}`)).length;

  async function handleTrack(status: string, ratingOverride?: number) {
    if (!authUser) return;
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
          tmdbId: data.id,
          mediaType: "tv",
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
        // Marking as Watched → check all episodes in this season
        if (newStatus === "completed" && trackStatus !== "completed") {
          setWatchedEpisodes((prev) => {
            const all = new Set(prev);
            data.episodes.forEach((ep) => all.add(`${data.seasonNumber}-${ep.number}`));
            return all;
          });
          // Fire API calls in background to mark all episodes
          data.episodes.forEach((ep) => {
            fetch("/api/episodes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, tmdbId: data.id, seasonNumber: data.seasonNumber, episodeNumber: ep.number }),
            }).catch(() => {});
          });
        }
        // Auto-check Episode 1 when starting Watching from idle
        if (newStatus === "watching" && !watchedEpisodes.has(`${data.seasonNumber}-1`)) {
          setWatchedEpisodes((prev) => {
            const next = new Set(prev);
            next.add(`${data.seasonNumber}-1`);
            return next;
          });
          fetch("/api/episodes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, tmdbId: data.id, seasonNumber: data.seasonNumber, episodeNumber: 1 }),
          }).catch(() => {});
        }
      } else {
        await fetch("/api/track", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            tmdbId: data.id,
            mediaType: "tv",
          }),
        });
        setTrackedAt(null);
        // If manually deactivating Watching/Watched → uncheck all episodes
        if ((trackStatus === "watching" || trackStatus === "completed") && watchedEpisodes.size > 0) {
          setWatchedEpisodes(new Set());
          for (const key of watchedEpisodes) {
            const [sn, en] = key.split("-").map(Number);
            fetch("/api/episodes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, tmdbId: data.id, seasonNumber: sn, episodeNumber: en }),
            }).catch(() => {});
          }
        }
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
        body: JSON.stringify({ username, tmdbId: data.id, mediaType: "tv", note: note.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setCollFeedback(`"${listName}"에 추가됨 ✓`);
        setCollections(prev => prev.map(c => c.id === listId ? { ...c, itemCount: c.itemCount + 1 } : c));
      } else {
        setCollFeedback(json.error || "추가 실패");
      }
    } catch {
      setCollFeedback("추가 실패");
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
      {/* Backdrop — TMDB > AniList > poster blur */}
      {(data.backdropPath || data.anilistBanner || data.posterPath) && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden">
          <PosterImage
            src={data.backdropPath?.replace("w342", "w1280") || data.anilistBanner || data.posterPath?.replace("w342", "w1280") || ""}
            alt=""
            fill
            priority
            unoptimized
            className={(!data.backdropPath && !data.anilistBanner) ? "blur-2xl scale-125 opacity-50" : ""}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-[#0f0f1a]/60 to-transparent" />
        </div>
      )}

      <div className={`relative px-4 md:px-0 z-10 ${(data.backdropPath || data.anilistBanner || data.posterPath) ? '-mt-20 md:-mt-32' : ''}`}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="flex-shrink-0 w-36 md:w-48 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-card shadow-2xl relative">
              <PosterImage
                src={data.seasonPoster}
                alt={data.seasonName}
                fill
                className="rounded-xl"
                sizes="(max-width: 768px) 144px, 192px"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-tight">
              {data.title}
            </h1>
            <p className="text-lg text-text-secondary mt-0.5">{data.seasonName}</p>
            {data.tagline && (
              <p className="text-sm text-text-secondary italic mt-1">
                &ldquo;{data.tagline}&rdquo;
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3 text-xs text-text-secondary">
              <span className="bg-bg-card px-2 py-0.5 rounded-full">{data.year}</span>
              <span className="bg-bg-card px-2 py-0.5 rounded-full uppercase">tv</span>
              <span className="bg-bg-card px-2 py-0.5 rounded-full">{data.status}</span>
              <span className="bg-bg-card px-2 py-0.5 rounded-full">
                {data.totalSeasons} Season{data.totalSeasons > 1 ? "s" : ""}
                {data.totalEpisodes ? ` · ${data.totalEpisodes} Ep` : ""}
              </span>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center md:justify-start">
              {data.genres.map((g) => (
                <span
                  key={g}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-bg-card text-accent-light border border-accent/30"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Star rating — only when Watched */}
            {isWatched && (
              <div className="flex justify-center md:justify-start mt-3">
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
                  color: isWanted ? "#14b8a6" : "#6b7280",
                  backgroundColor: isWanted ? "#14b8a610" : "var(--bg-card)",
                  border: isWanted ? "1px solid #14b8a640" : "1px solid var(--border-color)",
                }}
              >
                <HeartIcon active={isWanted} />
                TO WATCH
              </button>
              <button
                onClick={() => handleTrack("watching")}
                disabled={trackLoading}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all"
                style={{
                  color: isWatching ? "#14b8a6" : "#6b7280",
                  backgroundColor: isWatching ? "#14b8a610" : "var(--bg-card)",
                  border: isWatching ? "1px solid #14b8a640" : "1px solid var(--border-color)",
                }}
              >
                <PlayIcon active={isWatching} />
                WATCHING
              </button>
              <button
                onClick={() => handleTrack("completed")}
                disabled={trackLoading}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all"
                style={{
                  color: isWatched ? "#14b8a6" : "#6b7280",
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
                  <span className="text-[11px] ml-2 self-center text-accent">{collFeedback}</span>
                )}
                {showCollDropdown && (
                  <div className="absolute mt-8 w-52 bg-bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                    {collections.length === 0 ? (
                      <div className="px-3 py-3 text-[11px] text-text-secondary text-center">
                        No collections yet.
                        <a href="/library?tab=collections" className="block mt-1 text-accent hover:underline">Create one →</a>
                      </div>
                    ) : (
                      collections.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { addToCollection(c.id, c.name); setShowCollDropdown(false); }}
                          disabled={addingCollId === c.id}
                          className="w-full text-left px-3 py-2.5 text-xs text-text-primary hover:bg-bg-surface flex justify-between items-center transition-colors disabled:opacity-50"
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

            {/* Studios */}
            <div className="mt-3 text-xs text-text-secondary space-y-0.5">
              {data.createdBy && (
                <p>
                  Created by:{" "}
                  <span className="text-text-secondary">{data.createdBy.join(", ")}</span>
                </p>
              )}
              {data.networks && (
                <p>
                  Network:{" "}
                  <span className="text-text-secondary">{data.networks.join(", ")}</span>
                </p>
              )}
              {data.seasonAirDate && (
                <p>
                  Season aired:{" "}
                  <span className="text-text-secondary">{data.seasonAirDate}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── Season Tabs ─── */}
        {data.totalSeasons > 1 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Seasons</h2>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: data.totalSeasons }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    if (n !== data.seasonNumber) {
                      router.push(`/title/${data.id}/season/${n}?type=tv`);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    n === data.seasonNumber
                      ? "bg-accent text-white cursor-default"
                      : "bg-bg-card text-text-secondary hover:text-text-primary hover:bg-[#2d2d4a] border border-border hover:border-accent"
                  }`}
                >
                  S{n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Overview */}
        {data.overview && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-2">Overview</h2>
            <p className="text-sm text-text-secondary leading-relaxed">{data.overview}</p>
          </section>
        )}

        {/* Season description */}
        {data.seasonOverview && data.seasonOverview !== data.overview && (
          <section className="mt-4">
            <h2 className="text-md font-semibold text-text-secondary mb-1">About This Season</h2>
            <p className="text-sm text-text-secondary leading-relaxed">{data.seasonOverview}</p>
          </section>
        )}

        {/* ── AdSense ── */}
        <div className="mt-6">
          <div className="bg-bg-card border border-dashed border-border rounded-xl flex items-center justify-center" style={{ minHeight: 100 }}>
            <div className="text-center">
              <p className="text-[10px] text-text-secondary uppercase tracking-[0.15em] mb-1">Advertisement</p>
              <p className="text-xs text-text-secondary">AdSense · 320×100</p>
            </div>
          </div>
        </div>

        {/* Reviews for this series (shared across all seasons) */}
        <section className="mt-6">
          <ReviewSection tmdbId={data.id} mediaType="tv" trackStatus={trackStatus} trackVersion={trackVersion} trackRating={rating} authUser={authUser} />
        </section>

        {/* Episodes */}
        {data.episodes.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-text-primary">
                Episodes · {data.episodes.length}
              </h2>
              <div className="flex items-center gap-3">
                {totalEpPages > 1 && (
                  <span className="text-[11px] text-text-secondary">
                    {(currentPage - 1) * EPISODES_PER_PAGE + 1}–{Math.min(currentPage * EPISODES_PER_PAGE, data.episodes.length)}
                  </span>
                )}
                {watchedCount > 0 && (
                  <span className="text-xs text-text-secondary">
                    Watched {watchedCount}/{data.episodes.length}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {visibleEpisodes.map((ep) => {
                const epKey = `${data.seasonNumber}-${ep.number}`;
                const isWatched = watchedEpisodes.has(epKey);
                const isLoading = epToggleLoading === epKey;
                return (
                <div
                  key={ep.number}
                  className={`flex gap-3 bg-bg-card rounded-xl p-3 transition-all ${isWatched ? "opacity-50" : "hover:bg-bg-surface"}`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleEpisode(data.seasonNumber, ep.number)}
                    disabled={isLoading}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-2 ${
                      isWatched
                        ? "bg-accent border-accent"
                        : "border-[#3d3d5c] hover:border-accent"
                    } ${isLoading ? "animate-pulse" : ""}`}
                  >
                    {isWatched && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                  {ep.still ? (
                    <div className="flex-shrink-0 w-28 md:w-40 aspect-video rounded-lg overflow-hidden bg-bg-primary relative">
                      <PosterImage
                        src={ep.still}
                        alt={ep.name}
                        fill
                        className="rounded-lg"
                        sizes="(max-width: 768px) 112px, 160px"
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-28 md:w-40 aspect-video rounded-lg overflow-hidden bg-bg-primary flex items-center justify-center">
                      <span className="text-2xl text-[#25253a] font-bold">{ep.number}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-accent">{ep.number}</span>
                      <h3 className="text-sm font-medium text-text-primary truncate">{ep.name}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-text-secondary">
                      {ep.runtime > 0 && <span>{formatRuntime(ep.runtime)}</span>}
                      {ep.airDate && <span>{ep.airDate}</span>}
                      {ep.rating > 0 && <span className="text-gold">★ {ep.rating}</span>}
                    </div>
                    {ep.overview && (
                      <p className="mt-1 text-xs text-text-secondary leading-relaxed line-clamp-2">
                        {ep.overview}
                      </p>
                    )}
                  </div>
                </div>
              )})}
            </div>
            {data.episodes.length > EPISODES_PER_PAGE && (
              <div className="mt-4 flex items-center justify-center gap-1 flex-wrap">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded bg-bg-card text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                >
                  ← Prev
                </button>
                {Array.from({ length: totalEpPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalEpPages || Math.abs(p - currentPage) <= 2)
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
                        onClick={() => setCurrentPage(item as number)}
                        className={`w-7 h-7 text-xs rounded-full transition-colors ${
                          currentPage === item
                            ? "bg-accent text-white"
                            : "bg-bg-card text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalEpPages, p + 1))}
                  disabled={currentPage === totalEpPages}
                  className="px-2 py-1 text-xs rounded bg-bg-card text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </section>
        )}

        {/* Trailers */}
        {data.trailers.length > 0 && (
          <section id="trailers" className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">🎬 Trailers</h2>
            <div className="space-y-3">
              {data.trailers.slice(0, 3).map((v) => (
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

        {/* Cast */}
        {data.cast.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Cast</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {visibleCast.map((c) => (
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
                  <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
                  <p className="text-[10px] text-text-secondary truncate">{c.character}</p>
                </a>
              ))}
            </div>
            {data.cast.length > 6 && (
              <button
                onClick={() => setShowAllCast(!showAllCast)}
                className="mt-3 text-xs text-accent hover:underline mx-auto block"
              >
                {showAllCast ? "Show less" : `Show all ${data.cast.length} cast members`}
              </button>
            )}
          </section>
        )}

        {/* Recommended */}
        <SimilarSection items={data.similar} />
      </div>
    </div>
  );
}

type SimilarItem = { id: number; title: string; poster: string | null; rating: number; year: number; type: "movie" | "tv" };

function SimilarSection({ items }: { items: SimilarItem[] }) {
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
          <button onClick={() => scroll("left")} className="w-8 h-8 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-text-primary text-sm transition-colors">←</button>
          <button onClick={() => scroll("right")} className="w-8 h-8 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-text-primary text-sm transition-colors">→</button>
        </div>
      </div>
      <div ref={ref} className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar scroll-smooth">
        {items.map((item) => (
          <a key={item.id} href={`/title/${item.id}?type=${item.type}`} className="flex-shrink-0 w-28 group">
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-bg-card group-hover:scale-105 transition-transform relative">
              <PosterImage
                src={item.poster}
                alt={item.title}
                fill
                className="rounded-lg"
                sizes="112px"
              />
            </div>
            <p className="text-[11px] text-text-primary mt-1 line-clamp-1">{item.title}</p>
            <p className="text-[10px] text-text-secondary">★ {item.rating}</p>
          </a>
        ))}
      </div>
    </section>
  );
}