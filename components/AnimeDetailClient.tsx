"use client";

import { useState, useRef, useEffect } from "react";
import type { AnimeDetail, AnimeRecItem, AnimeEpisode } from "@/lib/anilist";
import { ReviewSection } from "@/components/ReviewSection";
import { StarInput } from "@/components/StarInput";
import { createClient } from "@/lib/supabase/client";
import PosterImage from "@/components/PosterImage";

// ─── Icons (same as DetailClient) ───
function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={active ? "text-pink-500" : "text-gray-400"}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78l1.06-1.06a5.5 5.5 0 0 0 0-7.78"/>
    </svg>
  );
}

function WatchingIcon({ active }: { active: boolean }) {
  return (
    <img
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
    <img
      src={active ? "/icons/watched-pink.png" : "/icons/watched-gray.png"}
      alt="Watched"
      width={20}
      height={20}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─── Main component ───

export default function AnimeDetailClient({ detail, episodes }: { detail: AnimeDetail; episodes: AnimeEpisode[] }) {
  const [showAllCast, setShowAllCast] = useState(false);
  const [showAllEp, setShowAllEp] = useState(false);
  const MAX_VISIBLE_EPS = 30;
  const [trackStatus, setTrackStatus] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [trackVersion, setTrackVersion] = useState(0);
  const [trackedAt, setTrackedAt] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authUser, setAuthUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
  const [epToggleLoading, setEpToggleLoading] = useState<string | null>(null);
  const supabase = createClient();

  // Collections
  const [collections, setCollections] = useState<{ id: string; name: string; itemCount: number }[]>([]);
  const [showCollDropdown, setShowCollDropdown] = useState(false);
  const [addingCollId, setAddingCollId] = useState<string | null>(null);
  const [collFeedback, setCollFeedback] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const visibleCast = showAllCast ? detail.characters : detail.characters.slice(0, 6);
  const visibleEpisodes = showAllEp ? episodes : episodes.slice(0, MAX_VISIBLE_EPS);

  // Fetch current tracking status + collections on mount
  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => setAuthUser(data.user ?? null)).catch(() => {});
    const username = localStorage.getItem("seriez-username") || "";

    fetch(`/api/track?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const match = data.find(
            (t: { tmdbId: number; mediaType: string }) =>
              t.tmdbId === detail.id && t.mediaType === "anime"
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
    fetch(`/api/episodes?username=${encodeURIComponent(username)}&tmdbId=${detail.id}`)
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

    fetch(`/api/collections?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.collections) setCollections(data.collections);
      })
      .catch(() => {});
  }, [detail.id]);

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
    if (!authUser) return;
    const username = authUser.user_metadata?.username || "";
    const effectiveRating = ratingOverride ?? rating;
    const isResubmit = status === "completed" && trackStatus === "completed" && ratingOverride !== undefined;
    const newStatus = isResubmit ? "completed" : (trackStatus === status ? null : status);

    setTrackLoading(true);
    try {
      if (newStatus) {
        const body: Record<string, unknown> = {
          username,
          tmdbId: detail.id,
          mediaType: "anime",
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
        // Marking as Watched → check all episodes
        if (newStatus === "completed" && trackStatus !== "completed" && episodes.length > 0) {
          setWatchedEpisodes((prev) => {
            const all = new Set(prev);
            episodes.forEach((ep) => all.add(`1-${ep.number}`));
            return all;
          });
          episodes.forEach((ep) => {
            fetch("/api/episodes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, tmdbId: detail.id, seasonNumber: 1, episodeNumber: ep.number }),
            }).catch(() => {});
          });
        }
      } else {
        await fetch("/api/track", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime" }),
        });
        setTrackedAt(null);
        // If manually unchecking Watching/Watched → uncheck all episodes
        if ((trackStatus === "watching" || trackStatus === "completed") && watchedEpisodes.size > 0) {
          setWatchedEpisodes(new Set());
          for (const key of watchedEpisodes) {
            const [, en] = key.split("-").map(Number);
            fetch("/api/episodes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, tmdbId: detail.id, seasonNumber: 1, episodeNumber: en }),
            }).catch(() => {});
          }
        }
      }
      setTrackStatus(newStatus);
      setTrackVersion(v => v + 1);
    } catch {}
    setTrackLoading(false);
  }

  async function toggleEpisode(episodeNumber: number) {
    if (!authUser) return;
    const key = `1-${episodeNumber}`; // anime uses season 1
    const username = authUser.user_metadata?.username || "";
    const wasWatched = watchedEpisodes.has(key);

    // Optimistic update
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
      setTrackStatus("watching");
      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime", status: "watching" }),
      });
    } else if (!willHaveWatched && trackStatus === "watching") {
      setTrackStatus(null);
      await fetch("/api/track", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime" }),
      });
    }

    try {
      await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: detail.id, seasonNumber: 1, episodeNumber }),
      });
    } catch {}
    setEpToggleLoading(null);

    // All episodes checked → auto-complete
    const nowAllWatched = !wasWatched && watchedEpisodes.size + 1 >= episodes.length;
    if (nowAllWatched && trackStatus !== "completed") {
      setTrackStatus("completed");
      setTrackedAt(new Date().toISOString());
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime", status: "completed" }),
      }).catch(() => {});
    }
  }

  const watchedCount = episodes.filter((ep) => watchedEpisodes.has(`1-${ep.number}`)).length;

  const isWanted = trackStatus === "plan_to_watch";
  const isWatching = trackStatus === "watching";
  const isWatched = trackStatus === "completed";

  async function addToCollection(listId: string, listName: string) {
    if (!authUser) return;
    const username = authUser.user_metadata?.username || "";
    setAddingCollId(listId);
    setCollFeedback(null);
    try {
      const res = await fetch(`/api/collections/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime" }),
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

  const seasonLabel = detail.season && detail.year
    ? `${detail.season} ${detail.year}`
    : detail.year ? String(detail.year) : "";

  // Estimate hours watched (for episodes × duration)
  const totalMinutes = detail.episodes > 0 && detail.duration > 0
    ? detail.episodes * detail.duration
    : 0;

  return (
    <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
      {/* Backdrop */}
      {detail.backdrop && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden">
          <PosterImage src={detail.backdrop} alt="" fill priority />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-[#0f0f1a]/60 to-transparent" />
        </div>
      )}

      <div className="relative px-4 md:px-0 -mt-20 md:-mt-32 z-10">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="flex-shrink-0 w-36 md:w-48 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#1a1a2e] shadow-2xl relative">
              <PosterImage src={detail.poster} alt={detail.title} fill className="rounded-xl" sizes="(max-width: 768px) 144px, 192px" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
              {detail.title}
            </h1>
            {detail.titleRomaji && detail.titleRomaji !== detail.title && (
              <p className="text-sm text-[#9ca3af] mt-0.5">{detail.titleRomaji}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3 text-xs text-[#9ca3af]">
              {seasonLabel && (
                <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">{seasonLabel}</span>
              )}
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full uppercase">{detail.format}</span>
              {detail.episodes > 0 && (
                <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">{detail.episodes} Ep</span>
              )}
              {detail.duration > 0 && (
                <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">{detail.duration}m</span>
              )}
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">{detail.status}</span>
            </div>

            {/* Rating bar */}
            <div className="flex items-center justify-center md:justify-start gap-3 mt-2">
              {detail.rating > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[#f59e0b] text-lg">★</span>
                  <span className="text-white font-bold text-lg">{detail.rating}</span>
                  <span className="text-[#6b7280] text-xs">/10</span>
                </div>
              )}
              {detail.popularity > 0 && (
                <span className="text-xs text-[#6b7280]">{detail.popularity.toLocaleString()} users</span>
              )}
              {totalMinutes > 0 && (
                <span className="text-xs text-[#6b7280]">
                  ~{Math.round(totalMinutes / 60)}h total
                </span>
              )}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center md:justify-start">
              {detail.genres.map((g) => (
                <span key={g} className="text-[11px] px-2.5 py-1 rounded-full bg-[#1a1a2e] text-[#c4b5fd] border border-[#6366f1]/30">
                  {g}
                </span>
              ))}
            </div>

            {/* Tags */}
            {detail.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 justify-center md:justify-start">
                {detail.tags.map((t) => (
                  <span key={t.name} className="text-[10px] px-2 py-0.5 rounded-full bg-[#2d2d4a]/50 text-[#9ca3af]">
                    {t.name}
                  </span>
                ))}
              </div>
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
                    <TrackButton icon={<HeartIcon active={isWanted} />} label="Want to Watch" active={isWanted} onClick={() => handleTrack("plan_to_watch")} disabled={trackLoading} />
                    <TrackButton icon={<WatchingIcon active={isWatching} />} label="Watching" active={isWatching} onClick={() => handleTrack("watching")} disabled={trackLoading} />
                    <TrackButton icon={<WatchedIcon active={isWatched} />} label="Watched" active={isWatched} onClick={() => handleTrack("completed")} disabled={trackLoading} />
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
                  <span className="text-sm font-bold mr-0.5">+</span> Add to Collection
                </button>
                {collFeedback && <span className="text-[11px] ml-2 self-center text-[#6366f1]">{collFeedback}</span>}
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

            {/* Star rating — only when Watched */}
            {isWatched && (
              <div className="flex justify-center md:justify-start mt-3">
                <StarInput value={rating} onChange={handleRatingChange} />
              </div>
            )}
            {isWatched && trackedAt && (
              <p className="text-[10px] text-[#6b7280] mt-1 text-center md:text-left">
                Watched {formatDate(trackedAt)}
              </p>
            )}

            {/* Studios */}
            {detail.studios.length > 0 && (
              <div className="mt-3 text-xs text-[#6b7280]">
                <span>Studio: </span>
                <span className="text-[#9ca3af]">{detail.studios.join(", ")}</span>
              </div>
            )}

            {/* Staff (directors) */}
            {detail.staff.length > 0 && (
              <div className="mt-1 text-xs text-[#6b7280]">
                <span>Staff: </span>
                <span className="text-[#9ca3af]">
                  {detail.staff.slice(0, 5).map(s => `${s.name} (${s.role})`).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Overview */}
        {detail.overview && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-2">Synopsis</h2>
            <p className="text-sm text-[#d1d5db] leading-relaxed">{detail.overview}</p>
          </section>
        )}

        {/* Episodes — interactive with watch tracking */}
        {episodes.length > 0 ? (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">
                Episodes · {episodes.length}
              </h2>
              {watchedCount > 0 && (
                <span className="text-xs text-[#9ca3af]">
                  Watched {watchedCount}/{episodes.length}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {visibleEpisodes.map((ep) => {
                const epKey = `1-${ep.number}`;
                const isWatched = watchedEpisodes.has(epKey);
                const isLoading = epToggleLoading === epKey;
                return (
                <div
                  key={ep.number}
                  className={`flex gap-3 bg-[#1a1a2e] rounded-xl p-3 transition-all ${isWatched ? "opacity-50" : "hover:bg-[#25253a]"}`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleEpisode(ep.number)}
                    disabled={isLoading || !authUser}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-2 ${
                      isWatched
                        ? "bg-[#6366f1] border-[#6366f1]"
                        : "border-[#3d3d5c] hover:border-[#6366f1]"
                    } ${isLoading ? "animate-pulse" : ""}`}
                    title={authUser ? (isWatched ? "Mark unwatched" : "Mark watched") : "Sign in to track"}
                  >
                    {isWatched && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-28 md:w-36 aspect-video rounded-lg overflow-hidden bg-[#0f0f1a] relative">
                    {ep.thumbnail ? (
                      <PosterImage src={ep.thumbnail} alt={ep.title} fill className="rounded-lg" sizes="(max-width: 768px) 112px, 144px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#6b7280] text-xs">
                        No preview
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#6366f1] bg-[#6366f1]/10 px-1.5 py-0.5 rounded">
                        {ep.number}
                      </span>
                      <h3 className="text-sm font-medium text-white truncate">{ep.title}</h3>
                    </div>
                    {ep.titleJapanese && (
                      <p className="text-[11px] text-[#6b7280] mt-0.5 truncate">
                        {ep.titleJapanese}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[#6b7280]">
                      {ep.airDate && <span>{ep.airDate}</span>}
                      {ep.duration > 0 && <span>{ep.duration}m</span>}
                    </div>
                    {ep.synopsis && (
                      <p className="text-[11px] text-[#9ca3af] leading-relaxed mt-1 line-clamp-2">
                        {ep.synopsis}
                      </p>
                    )}
                  </div>
                </div>
              )})}
            </div>
            {episodes.length > MAX_VISIBLE_EPS && (
              <button
                onClick={() => setShowAllEp(!showAllEp)}
                className="mt-3 text-xs text-[#6366f1] hover:underline mx-auto block"
              >
                {showAllEp ? "Show less" : `Show all ${episodes.length} episodes`}
              </button>
            )}
            {!authUser && (
              <p className="text-[11px] text-[#6b7280] mt-2 text-center">
                <a href="/login" className="text-[#6366f1] hover:underline">Sign in</a> to track watched episodes
              </p>
            )}
          </section>
        ) : episodes.length === 0 && detail.episodes > 0 ? (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3">Episodes</h2>
            <div className="bg-[#1a1a2e] rounded-xl p-4 text-center">
              <p className="text-sm text-[#9ca3af]">Episode data not available for this title.</p>
              <p className="text-[11px] text-[#6b7280] mt-1">{detail.episodes} episodes total</p>
            </div>
          </section>
        ) : null}

        {/* Trailer */}
        {detail.trailer && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3">🎬 Trailer</h2>
            <div className="aspect-video rounded-xl overflow-hidden bg-[#1a1a2e]">
              <iframe
                src={`https://www.youtube.com/embed/${detail.trailer.id}`}
                title="Trailer"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </section>
        )}

        {/* Characters + Voice Actors */}
        {detail.characters.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3">Characters & Voice Actors</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {visibleCast.map((c) => (
                <div key={c.name} className="bg-[#1a1a2e] rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-[#25253a] relative">
                    <PosterImage src={c.image} alt={c.name} fill className="rounded-full" sizes="40px" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{c.name}</p>
                    <p className="text-[10px] text-[#6366f1] truncate">{c.role}</p>
                    {c.voiceActor && (
                      <p className="text-[10px] text-[#6b7280] truncate">VA: {c.voiceActor}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {detail.characters.length > 6 && (
              <button
                onClick={() => setShowAllCast(!showAllCast)}
                className="mt-3 text-xs text-[#6366f1] hover:underline mx-auto block"
              >
                {showAllCast ? "Show less" : `Show all ${detail.characters.length} characters`}
              </button>
            )}
          </section>
        )}

        {/* Relations */}
        {detail.relations.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3">Related</h2>
            <div className="flex flex-wrap gap-2">
              {detail.relations.slice(0, 5).map((r) => (
                <a
                  key={r.id}
                  href={`/title/${r.id}?type=anime`}
                  className="px-3 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#25253a] border border-[#2d2d4a] hover:border-[#6366f1] text-xs text-[#d1d5db] transition-all"
                >
                  {r.title}
                  <span className="ml-1.5 text-[10px] text-[#6b7280]">{r.format}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {detail.recommendations.length > 0 && (
          <AnimeRecSection items={detail.recommendations} />
        )}

        {/* Reviews */}
        <section className="mt-6">
          <ReviewSection tmdbId={detail.id} mediaType="anime" trackStatus={trackStatus} trackVersion={trackVersion} />
        </section>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function TrackButton({ icon, label, active, onClick, disabled }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
      style={{
        color: active ? "#ec4899" : "#9ca3af",
        borderColor: active ? "#ec489950" : "#2d2d4a",
        backgroundColor: active ? "#ec489910" : "#1a1a2e",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function AnimeRecSection({ items }: { items: AnimeRecItem[] }) {
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
          <button onClick={() => scroll("left")} className="w-8 h-8 rounded-full bg-[#1a1a2e] hover:bg-[#25253a] flex items-center justify-center text-white text-sm transition-colors">←</button>
          <button onClick={() => scroll("right")} className="w-8 h-8 rounded-full bg-[#1a1a2e] hover:bg-[#25253a] flex items-center justify-center text-white text-sm transition-colors">→</button>
        </div>
      </div>
      <div ref={ref} className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar scroll-smooth">
        {items.map((item) => (
          <a key={item.id} href={`/title/${item.id}?type=anime`} className="flex-shrink-0 w-32 md:w-36 block snap-start">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#1a1a2e] group md:hover:scale-105 transition-transform">
              <PosterImage src={item.poster} alt={item.title} fill className="rounded-xl" sizes="(max-width: 768px) 128px, 144px" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-[#f59e0b]">
                ★ {item.rating || "—"}
              </div>
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-[11px] font-medium text-white leading-tight line-clamp-2">{item.title}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.genres.slice(0, 2).map((g) => (
                <span key={g} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#1a1a2e] text-[#9ca3af]">{g}</span>
              ))}
              {item.year > 0 && <span className="text-[9px] text-[#6b7280]">{item.year}</span>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
