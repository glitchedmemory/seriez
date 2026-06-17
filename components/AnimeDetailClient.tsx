"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AnimeDetail, AnimeRecItem, AnimeEpisode } from "@/lib/anilist";
import { ReviewSection } from "@/components/ReviewSection";
import { StarInput } from "@/components/StarInput";
import { createClient } from "@/lib/supabase/client";
import PosterImage from "@/components/PosterImage";

// ─── Icons (same as DetailClient) ───
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

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─── Main component ───

export default function AnimeDetailClient({ detail, episodes }: { detail: AnimeDetail; episodes: AnimeEpisode[] }) {
  const [showAllCast, setShowAllCast] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const EPISODES_PER_PAGE = 50;
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
  const router = useRouter();

  // Collections
  const [collections, setCollections] = useState<{ id: string; name: string; itemCount: number }[]>([]);
  const [showCollDropdown, setShowCollDropdown] = useState(false);
  const [addingCollId, setAddingCollId] = useState<string | null>(null);
  const [collFeedback, setCollFeedback] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [activeNoteCollId, setActiveNoteCollId] = useState<string | null>(null);
  const [activeNoteCollName, setActiveNoteCollName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const visibleCast = showAllCast ? detail.characters : detail.characters.slice(0, 6);
  const totalPages = Math.ceil(episodes.length / EPISODES_PER_PAGE);
  const visibleEpisodes = episodes.slice((currentPage - 1) * EPISODES_PER_PAGE, currentPage * EPISODES_PER_PAGE);

  // Fetch current tracking status + collections on mount
  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => setAuthUser(session?.user ?? null)).catch(() => {});
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
        // Auto-check Episode 1 when starting Watching from idle
        if (newStatus === "watching" && !watchedEpisodes.has("1-1")) {
          setWatchedEpisodes((prev) => {
            const next = new Set(prev);
            next.add("1-1");
            return next;
          });
          fetch("/api/episodes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, tmdbId: detail.id, seasonNumber: 1, episodeNumber: 1 }),
          }).catch(() => {});
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

    // Was completed, now unchecking an episode → downgrade to watching
    if (trackStatus === "completed" && wasWatched && watchedEpisodes.size - 1 < episodes.length) {
      setTrackStatus("watching");
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime", status: "watching" }),
      }).catch(() => {});
    }

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
        body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime", note: note.trim() }),
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

  const seasonLabel = detail.season && detail.year
    ? `${detail.season} ${detail.year}`
    : detail.year ? String(detail.year) : "";

  // ─── Season tabs from relations ───
  const seasonTabs = (() => {
    // Only TV series have season tabs — movies/OVAs/etc don't
    if (detail.format !== "TV") return [];

    // Helper: extract season number from title
    // "Season 2" → 2, "2nd Season" → 2, "Final Season" → 99 (last)
    const extractSeasonNum = (t: string): number | null => {
      const s = t.match(/season\s*(\d+)/i) || t.match(/(\d+)(?:st|nd|rd|th)\s*season/i);
      if (s) return parseInt(s[1]);
      if (/\bfinal\s*season\b/i.test(t)) return 99;
      // "Part 2" without season → indeterminate, return null
      return null;
    };

    // Check if two titles share significant words (to filter crossovers)
    const hasSharedWords = (a: string, b: string): boolean => {
      // Strip brackets, special characters, and normalize for word matching
      const clean = (s: string) => s.toLowerCase().replace(/[【】\[\]「」『』()（）]/g, " ").replace(/[^a-z0-9\s]/g, "");
      const wordsA = new Set(clean(a).split(/\s+/).filter(w => w.length > 2));
      const wordsB = clean(b).split(/\s+/);
      let match = 0;
      for (const w of wordsB) {
        if (w.length > 2 && wordsA.has(w)) match++;
      }
      return match >= 1; // at least one significant shared word
    };

    // Spin-off / non-season keywords to exclude
    const isSpinOff = (t: string): boolean =>
      /\b(?:junior high|high school|log:|movie|film|ova|special|recap|compilation)\b/i.test(t);

    // Find TV sequels/prequels — strict filtering
    const currentTitle = detail.title;
    const relatedTV = detail.relations.filter(r => {
      if (r.type !== "ANIME") return false;
      if (r.format && r.format !== "TV") return false;
      if (!hasSharedWords(currentTitle, r.title)) return false; // crossover check
      if (isSpinOff(r.title)) return false;
      if (/\bcour\b/i.test(r.title)) return false;
      return true;
    });

    // Also filter out the current anime's own ID if it appears (shouldn't, but safety)
    const deduped = relatedTV.filter(r => r.id !== detail.id);

    if (deduped.length === 0 && !extractSeasonNum(detail.title)) return [];

    // Combine current + relations
    const allItems = [
      { id: detail.id, title: detail.title, seasonYear: detail.year || null as number | null },
      ...deduped.map(r => ({ id: r.id, title: r.title, seasonYear: r.seasonYear })),
    ].sort((a, b) => {
      const sa = extractSeasonNum(a.title);
      const sb = extractSeasonNum(b.title);
      // Null-season entries (original series) come first, sorted by year
      if (sa === null && sb === null) {
        if (a.seasonYear && b.seasonYear) {
          const ydiff = a.seasonYear - b.seasonYear;
          if (ydiff !== 0) return ydiff;
          return a.id - b.id; // tiebreaker: lower AniList ID = earlier season
        }
        if (a.seasonYear) return -1;
        if (b.seasonYear) return 1;
        return a.id - b.id; // tiebreaker: lower AniList ID = earlier season
      }
      if (sa === null) return -1;
      if (sb === null) return 1;
      return sa - sb;
    });

    // Assign labels
    const explicitSeasons = new Set(
      allItems.map(item => extractSeasonNum(item.title)).filter((n): n is number => n !== null && n !== 99)
    );
    let nextFallback = 1;

    const tabs = allItems.map((item) => {
      const num = extractSeasonNum(item.title);
      let label: string;
      if (num === 99) {
        label = "Final"; // "Final Season" gets special label
      } else if (num !== null) {
        label = `S${num}`;
      } else {
        while (explicitSeasons.has(nextFallback)) nextFallback++;
        label = `S${nextFallback++}`;
      }
      return {
        id: item.id,
        title: label,
        isActive: item.id === detail.id,
      };
    });

    // Deduplicate by label — keep only first occurrence of each season/part label
    const seenLabels = new Set<string>();
    const dedupedTabs = tabs.filter(t => {
      if (seenLabels.has(t.title)) return false;
      seenLabels.add(t.title);
      return true;
    });

    // Only show tabs if there are at least 2 distinct entries
    if (dedupedTabs.length < 2) return [];
    return dedupedTabs;
  })();

  // Estimate hours watched (for episodes × duration)
  const totalMinutes = detail.episodes > 0 && detail.duration > 0
    ? detail.episodes * detail.duration
    : 0;

  return (
    <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
      {/* Backdrop — fallback to blurred poster when no backdrop */}
      {(detail.backdrop || detail.poster) && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden">
          <PosterImage src={detail.backdrop || detail.poster} alt="" fill priority unoptimized className={!detail.backdrop ? "blur-2xl scale-125 opacity-50" : ""} />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-[#0f0f1a]/60 to-transparent" />
        </div>
      )}

      <div className={`relative px-4 md:px-0 z-10 ${(detail.backdrop || detail.poster) ? '-mt-20 md:-mt-32' : ''}`}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="flex-shrink-0 w-36 md:w-48 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-card shadow-2xl relative">
              <PosterImage src={detail.poster} alt={detail.title} fill className="rounded-xl" sizes="(max-width: 768px) 144px, 192px" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-tight">
              {detail.title}
            </h1>
            {detail.titleRomaji && detail.titleRomaji !== detail.title && (
              <p className="text-sm text-text-secondary mt-0.5">{detail.titleRomaji}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3 text-xs text-text-secondary">
              {seasonLabel && (
                <span className="bg-bg-card px-2 py-0.5 rounded-full">{seasonLabel}</span>
              )}
              <span className="bg-bg-card px-2 py-0.5 rounded-full uppercase">{detail.format}</span>
              {detail.episodes > 0 && (
                <span className="bg-bg-card px-2 py-0.5 rounded-full">{detail.episodes} Ep</span>
              )}
              {detail.duration > 0 && (
                <span className="bg-bg-card px-2 py-0.5 rounded-full">{detail.duration}m</span>
              )}
              <span className="bg-bg-card px-2 py-0.5 rounded-full">{detail.status}</span>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center md:justify-start">
              {detail.genres.map((g) => (
                <span key={g} className="text-[11px] px-2.5 py-1 rounded-full bg-bg-card text-accent-light border border-accent/30">
                  {g}
                </span>
              ))}
            </div>

            {/* Tags */}
            {detail.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 justify-center md:justify-start">
                {detail.tags.map((t) => (
                  <span key={t.name} className="text-[10px] px-2 py-0.5 rounded-full bg-bg-card-hover/50 text-text-secondary">
                    {t.name}
                  </span>
                ))}
              </div>
            )}

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
                        backgroundColor: isWanted ? "#14b8a610" : "var(--color-bg-card)",
                        border: isWanted ? "1px solid #14b8a640" : "1px solid var(--color-border)",
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
                        backgroundColor: isWatching ? "#14b8a610" : "#1a1a2e",
                        border: isWatching ? "1px solid #14b8a640" : "1px solid #2d2d4a",
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
                        backgroundColor: isWatched ? "#14b8a610" : "#1a1a2e",
                        border: isWatched ? "1px solid #14b8a640" : "1px solid #2d2d4a",
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
                  <span className="text-sm font-bold mr-0.5">+</span> Add to Collection
                </button>
                {collFeedback && <span className={`text-[12px] font-medium ml-2 self-center px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                  collFeedback.includes("✓") ? "bg-green-500/15 text-green-400" :
                  collFeedback.includes("Failed") ? "bg-red-500/15 text-red-400" :
                  "text-accent"
                }`}>{collFeedback}</span>}
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
                            placeholder="e.g. Best anime of the season"
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

            {/* Studios */}
            {detail.studios.length > 0 && (
              <div className="mt-3 text-xs text-text-secondary">
                <span>Studio: </span>
                <span className="text-text-secondary">{detail.studios.join(", ")}</span>
              </div>
            )}

            {/* Staff (directors) */}
            {detail.staff.length > 0 && (
              <div className="mt-1 text-xs text-text-secondary">
                <span>Staff: </span>
                <span className="text-text-secondary">
                  {detail.staff.slice(0, 5).map(s => `${s.name} (${s.role})`).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── Season Tabs ─── */}
        {seasonTabs.length > 1 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Seasons</h2>
            <div className="flex flex-wrap gap-2">
              {seasonTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (!tab.isActive) {
                      router.push(`/title/${tab.id}?type=anime`);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    tab.isActive
                      ? "bg-accent text-white cursor-default"
                      : "bg-bg-card text-text-secondary hover:text-text-primary hover:bg-[#2d2d4a] border border-border hover:border-accent"
                  }`}
                >
                  {tab.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Overview */}
        {detail.overview && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-2">Overview</h2>
            <p className="text-sm text-text-secondary leading-relaxed">{detail.overview}</p>
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

        {/* Reviews */}
        <section className="mt-6">
          <ReviewSection tmdbId={detail.id} mediaType="anime" trackStatus={trackStatus} trackVersion={trackVersion} trackRating={rating} authUser={authUser} />
        </section>

        {/* Episodes — interactive with watch tracking */}
        {episodes.length > 0 ? (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-text-primary">
                Episodes · {episodes.length}
              </h2>
              <div className="flex items-center gap-3">
                {totalPages > 1 && (
                  <span className="text-[11px] text-text-secondary">
                    {(currentPage - 1) * EPISODES_PER_PAGE + 1}–{Math.min(currentPage * EPISODES_PER_PAGE, episodes.length)}
                  </span>
                )}
                {watchedCount > 0 && (
                  <span className="text-xs text-text-secondary">
                    Watched {watchedCount}/{episodes.length}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {visibleEpisodes.map((ep) => {
                const epKey = `1-${ep.number}`;
                const isWatched = watchedEpisodes.has(epKey);
                const isLoading = epToggleLoading === epKey;
                return (
                <div
                  key={ep.number}
                  className={`flex gap-3 bg-bg-card rounded-xl p-3 transition-all ${isWatched ? "opacity-50" : "hover:bg-bg-surface"}`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleEpisode(ep.number)}
                    disabled={isLoading || !authUser}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-2 ${
                      isWatched
                        ? "bg-accent border-accent"
                        : "border-[#3d3d5c] hover:border-accent"
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
                  <div className="flex-shrink-0 w-28 md:w-36 aspect-video rounded-lg overflow-hidden bg-bg-primary relative">
                    {ep.thumbnail ? (
                      <PosterImage src={ep.thumbnail} alt={ep.title} fill className="rounded-lg" sizes="(max-width: 768px) 112px, 144px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-secondary text-xs">
                        No preview
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                        {ep.number}
                      </span>
                      <h3 className="text-sm font-medium text-text-primary truncate">{ep.title}</h3>
                    </div>
                    {ep.titleJapanese && (
                      <p className="text-[11px] text-text-secondary mt-0.5 truncate">
                        {ep.titleJapanese}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-text-secondary">
                      {ep.airDate && <span>{ep.airDate}</span>}
                      {ep.duration > 0 && <span>{ep.duration}m</span>}
                    </div>
                    {ep.synopsis && (
                      <p className="text-[11px] text-text-secondary leading-relaxed mt-1 line-clamp-2">
                        {ep.synopsis}
                      </p>
                    )}
                  </div>
                </div>
              )})}
            </div>
            {episodes.length > EPISODES_PER_PAGE && (
              <div className="mt-4 flex items-center justify-center gap-1 flex-wrap">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded bg-bg-card text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
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
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded bg-bg-card text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
            {!authUser && (
              <p className="text-[11px] text-text-secondary mt-2 text-center">
                <a href="/login" className="text-accent hover:underline">Sign in</a> to track watched episodes
              </p>
            )}
          </section>
        ) : episodes.length === 0 && detail.episodes > 0 ? (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Episodes</h2>
            <div className="bg-bg-card rounded-xl p-4 text-center">
              <p className="text-sm text-text-secondary">Episode data not available for this title.</p>
              <p className="text-[11px] text-text-secondary mt-1">{detail.episodes} episodes total</p>
            </div>
          </section>
        ) : null}

        {/* Trailer */}
        {detail.trailer && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">🎬 Trailer</h2>
            <div className="aspect-video rounded-xl overflow-hidden bg-bg-card">
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
            <h2 className="text-lg font-semibold text-text-primary mb-3">Characters & Voice Actors</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {visibleCast.map((c) => (
                <div key={c.name} className="bg-bg-card rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-bg-surface relative">
                    <PosterImage src={c.image} alt={c.name} fill className="rounded-full" sizes="40px" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
                    <p className="text-[10px] text-accent truncate">{c.role}</p>
                    {c.voiceActor && (
                      <p className="text-[10px] text-text-secondary truncate">VA: {c.voiceActor}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {detail.characters.length > 6 && (
              <button
                onClick={() => setShowAllCast(!showAllCast)}
                className="mt-3 text-xs text-accent hover:underline mx-auto block"
              >
                {showAllCast ? "Show less" : `Show all ${detail.characters.length} characters`}
              </button>
            )}
          </section>
        )}

        {/* Recommendations */}
        <AnimeRecSection items={detail.recommendations} />
      </div>
    </div>
  );
}

// ─── Sub-components ───

function AnimeRecSection({ items }: { items: AnimeRecItem[] }) {
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
          <a key={item.id} href={`/title/${item.id}?type=anime`} className="flex-shrink-0 w-32 md:w-36 block snap-start">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-bg-card group md:hover:scale-105 transition-transform">
              <PosterImage src={item.poster} alt={item.title} fill className="rounded-xl" sizes="(max-width: 768px) 128px, 144px" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-gold">
                ★ {item.rating || "—"}
              </div>
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-[11px] font-medium text-text-primary leading-tight line-clamp-2">{item.title}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.genres.slice(0, 2).map((g) => (
                <span key={g} className="text-[9px] px-1.5 py-0.5 rounded-full bg-bg-card text-text-secondary">{g}</span>
              ))}
              {item.year > 0 && <span className="text-[9px] text-text-secondary">{item.year}</span>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
