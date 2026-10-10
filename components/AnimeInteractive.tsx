"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AnimeDetail, AnimeEpisode } from "@/lib/anilist";
import { getAnimeSagas, type AnimeSaga } from "@/lib/anime-sagas";
import { ReviewSection } from "@/components/ReviewSection";
import { StarInput } from "@/components/StarInput";
import { createClient } from "@/lib/supabase/client";
import { stripHtml } from "@/lib/strip-html";

// ─── Shared request helpers ────────────────────────────────────────────────
// The anime page renders three AnimeInteractive instances (buttons-only /
// episodes-only / reviews-only) and each one loads the same data on mount, so a
// single page view used to fire the same GET three times. Collapse identical
// in-flight GETs into one request (retrying a 429/5xx once).
const inflightGets = new Map<string, Promise<any>>();

function getJsonOnce(url: string): Promise<any> {
  const existing = inflightGets.get(url);
  if (existing) return existing;
  const p = (async () => {
    let res = await fetch(url, { cache: "no-cache" });
    if (!res.ok && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1200));
      res = await fetch(url, { cache: "no-cache" });
    }
    if (!res.ok) throw new Error("GET " + url + " -> " + res.status);
    return res.json();
  })().finally(() => {
    inflightGets.delete(url);
  });
  inflightGets.set(url, p);
  return p;
}

// A user's own write must never be lost to a transient 429/5xx (the API is rate
// limited per IP). Retry with backoff and return the real outcome so the UI can
// revert the optimistic change instead of showing a save that never happened.
async function sendJsonData(
  method: "POST" | "DELETE",
  url: string,
  body: unknown,
  attempts = 3
): Promise<{ ok: boolean; data: any }> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        return { ok: true, data };
      }
      if (res.status !== 429 && res.status < 500) return { ok: false, data: null };
    } catch {
      // network hiccup — retry
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
  }
  return { ok: false, data: null };
}

async function sendJson(
  method: "POST" | "DELETE",
  url: string,
  body: unknown,
  attempts = 3
): Promise<boolean> {
  return (await sendJsonData(method, url, body, attempts)).ok;
}

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
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function AnimeInteractive({ detail, episodes, mode }: { detail: AnimeDetail; episodes: AnimeEpisode[]; mode?: "buttons-only" | "reviews-only" | "episodes-only" }) {
  const [trackStatus, setTrackStatus] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [trackVersion, setTrackVersion] = useState(0);
  const [trackedAt, setTrackedAt] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authUser, setAuthUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
  const [epToggleLoading, setEpToggleLoading] = useState<string | null>(null);
  const [epSaveError, setEpSaveError] = useState(false);
  const [collections, setCollections] = useState<{ id: string; name: string; itemCount: number }[]>([]);
  const [showCollDropdown, setShowCollDropdown] = useState(false);
  const [addingCollId, setAddingCollId] = useState<string | null>(null);
  const [collFeedback, setCollFeedback] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [activeNoteCollId, setActiveNoteCollId] = useState<string | null>(null);
  const [activeNoteCollName, setActiveNoteCollName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const EPISODES_PER_PAGE = 10;

  // Saga filtering (One Piece)
  const sagas = getAnimeSagas(detail.id);
  const [selectedSaga, setSelectedSaga] = useState<AnimeSaga | null>(null);
  const filteredEpisodes = selectedSaga
    ? episodes.filter(ep => ep.number >= selectedSaga.start && ep.number <= selectedSaga.end)
    : episodes;
  const totalPages = Math.ceil(filteredEpisodes.length / EPISODES_PER_PAGE);
  const visibleEpisodes = filteredEpisodes.slice((currentPage - 1) * EPISODES_PER_PAGE, currentPage * EPISODES_PER_PAGE);
  const supabase = createClient();
  const router = useRouter();

  const isWanted = trackStatus === "plan_to_watch";
  const isWatching = trackStatus === "watching";
  const isWatched = trackStatus === "completed";
  const watchedCount = filteredEpisodes.filter((ep) => watchedEpisodes.has(`1-${ep.number}`)).length;

  // Reset page when saga changes
  useEffect(() => { setCurrentPage(1); }, [selectedSaga]);

  // Fetch tracking + collections on mount
  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      const uname = session?.user?.user_metadata?.username || localStorage.getItem("seriez-username");
      if (!uname) return;
      const username = uname;
      getJsonOnce(`/api/track?username=${encodeURIComponent(username)}`)
        .then((data) => {
          if (Array.isArray(data)) {
            const match = data.find((t: any) => t.tmdbId === detail.id && t.mediaType === "anime");
            if (match) { setTrackStatus(match.status); setRating(match.rating || 0); setTrackedAt(match.updatedAt || null); }
          }
        }).catch(() => {});
      getJsonOnce(`/api/episodes?username=${encodeURIComponent(username)}&tmdbId=${detail.id}`)
        .then((epData) => {
          if (epData.episodes) {
            const set = new Set<string>();
            epData.episodes.forEach((ep: any) => set.add(`${ep.seasonNumber}-${ep.episodeNumber}`));
            setWatchedEpisodes(set);
          }
        }).catch(() => {});
      getJsonOnce(`/api/collections?username=${encodeURIComponent(username)}`)
        .then((data) => { if (data.collections) setCollections(data.collections); }).catch(() => {});
    }).catch(() => {});
  }, [detail.id]);

  useEffect(() => {
    if (!epSaveError) return;
    const timer = setTimeout(() => setEpSaveError(false), 7000);
    return () => clearTimeout(timer);
  }, [epSaveError]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowCollDropdown(false);
    }
    if (showCollDropdown) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCollDropdown]);

  // Sync state across multiple instances via custom events
  const trackKey = `${detail.id}`;
  useEffect(() => {
    function onTrackChange(e: CustomEvent) {
      if (e.detail.key === trackKey) {
        if (e.detail.status !== undefined) setTrackStatus(e.detail.status);
        if (e.detail.rating !== undefined) setRating(e.detail.rating);
        if (e.detail.trackedAt !== undefined) setTrackedAt(e.detail.trackedAt);
        if (e.detail.watchedEpisodes) setWatchedEpisodes(new Set(e.detail.watchedEpisodes));
      }
    }
    window.addEventListener("seriez:anime-track-change", onTrackChange as EventListener);
    return () => window.removeEventListener("seriez:anime-track-change", onTrackChange as EventListener);
  }, [trackKey]);

  function syncTrackState(status: string | null, extra?: { rating?: number; trackedAt?: string; watchedEpisodes?: string[] }) {
    setTrackStatus(status);
    if (extra?.rating !== undefined) setRating(extra.rating);
    if (extra?.trackedAt !== undefined) setTrackedAt(extra.trackedAt);
    window.dispatchEvent(new CustomEvent("seriez:anime-track-change", {
      detail: { key: trackKey, status, ...extra }
    }));
  }

  async function handleTrack(status: string, ratingOverride?: number) {
    if (!authUser) { router.push("/signup"); return; }
    const username = authUser.user_metadata?.username || "";
    const effectiveRating = ratingOverride ?? rating;
    const newStatus = (trackStatus === status && !ratingOverride) ? null : status;
    setTrackLoading(true);
    let json: any = null;
    try {
      if (newStatus) {
        const body: Record<string, unknown> = {
          username,
          tmdbId: detail.id,
          mediaType: "anime",
          status: newStatus,
          title: detail.title || undefined,
          posterUrl: detail.poster || undefined,
          year: detail.year || undefined,
          tmdbRating: detail.rating || undefined,
        };
        if (status === "completed" && effectiveRating > 0) body.rating = effectiveRating;
        const save = await sendJsonData("POST", "/api/track", body);
        if (!save.ok) {
          // 작품 상태 저장 실패: 화면 상태를 바꾸지 않고 알린다
          setEpSaveError(true);
          setTrackLoading(false);
          return;
        }
        json = save.data;
        setTrackedAt(json?.updatedAt || new Date().toISOString());
        if (newStatus === "completed" && trackStatus !== "completed" && episodes.length > 0) {
          // 에피소드 저장이 실제로 성공한 것만 체크로 표시한다.
          // (한 번에 수백 건을 보내면 요청 한도에 걸리므로 8건씩 나눠 보낸다)
          const saved: number[] = [];
          for (let i = 0; i < episodes.length; i += 8) {
            const chunk = episodes.slice(i, i + 8);
            const results = await Promise.all(
              chunk.map((ep) =>
                sendJson("POST", "/api/episodes", {
                  username,
                  tmdbId: detail.id,
                  seasonNumber: 1,
                  episodeNumber: ep.number,
                })
              )
            );
            chunk.forEach((ep, idx) => {
              if (results[idx]) saved.push(ep.number);
            });
          }
          setWatchedEpisodes((prev) => {
            const next = new Set(prev);
            saved.forEach((n) => next.add(`1-${n}`));
            return next;
          });
          if (saved.length !== episodes.length) setEpSaveError(true);
        }
        if (newStatus === "watching" && !watchedEpisodes.has("1-1")) {
          const epSaved = await sendJson("POST", "/api/episodes", {
            username,
            tmdbId: detail.id,
            seasonNumber: 1,
            episodeNumber: 1,
          });
          if (epSaved) {
            setWatchedEpisodes((prev) => { const next = new Set(prev); next.add("1-1"); return next; });
          } else {
            setEpSaveError(true);
          }
        }
      } else {
        const removed = await sendJson("DELETE", "/api/track", { username, tmdbId: detail.id, mediaType: "anime" });
        if (!removed) {
          setEpSaveError(true);
          setTrackLoading(false);
          return;
        }
        setTrackedAt(null);
        if ((trackStatus === "watching" || trackStatus === "completed") && watchedEpisodes.size > 0) {
          setWatchedEpisodes(new Set());
          for (const key of watchedEpisodes) { const [, en] = key.split("-").map(Number); void sendJson("POST", "/api/episodes", { username, tmdbId: detail.id, seasonNumber: 1, episodeNumber: en }); }
        }
      }
      syncTrackState(newStatus, { trackedAt: newStatus ? (json?.updatedAt || new Date().toISOString()) : null });
      setTrackVersion(v => v + 1);
    } catch {}
    setTrackLoading(false);
  }

  async function toggleEpisode(episodeNumber: number) {
    if (!authUser) return;
    const key = `1-${episodeNumber}`;
    const username = authUser.user_metadata?.username || "";
    const wasWatched = watchedEpisodes.has(key);
    setEpToggleLoading(key);

    // 1) 에피소드 기록을 먼저 저장하고 결과를 확인한다.
    //    저장이 안 됐는데 체크만 켜두면 새로고침 후 사라지므로, 실패하면 체크를 켜지 않고 알린다.
    const epSaved = await sendJson("POST", "/api/episodes", {
      username,
      tmdbId: detail.id,
      seasonNumber: 1,
      episodeNumber,
    });
    if (!epSaved) {
      setEpToggleLoading(null);
      setEpSaveError(true);
      return;
    }
    setWatchedEpisodes((prev) => { const next = new Set(prev); if (wasWatched) next.delete(key); else next.add(key); return next; });

    const willHaveWatched = !wasWatched || watchedEpisodes.size > 1;
    if (willHaveWatched && (!trackStatus || trackStatus === "plan_to_watch" || trackStatus === "completed")) {
      const ok = await sendJson("POST", "/api/track", { username, tmdbId: detail.id, mediaType: "anime", status: "watching", title: detail.title || undefined, posterUrl: detail.poster || undefined, year: detail.year || undefined, tmdbRating: detail.rating || undefined });
      if (ok) syncTrackState("watching"); else setEpSaveError(true);
    } else if (!willHaveWatched && trackStatus === "watching") {
      const ok = await sendJson("DELETE", "/api/track", { username, tmdbId: detail.id, mediaType: "anime" });
      if (ok) syncTrackState(null); else setEpSaveError(true);
    }
    setEpToggleLoading(null);
    if (trackStatus === "completed" && wasWatched && watchedEpisodes.size - 1 < episodes.length) {
      const ok = await sendJson("POST", "/api/track", { username, tmdbId: detail.id, mediaType: "anime", status: "watching", title: detail.title || undefined, posterUrl: detail.poster || undefined, year: detail.year || undefined, tmdbRating: detail.rating || undefined });
      if (ok) syncTrackState("watching"); else setEpSaveError(true);
    }
    const nowAllWatched = !wasWatched && watchedEpisodes.size + 1 >= episodes.length;
    if (nowAllWatched && trackStatus !== "completed") {
      const ok = await sendJson("POST", "/api/track", { username, tmdbId: detail.id, mediaType: "anime", status: "completed" });
      if (ok) syncTrackState("completed", { trackedAt: new Date().toISOString() }); else setEpSaveError(true);
    }
  }

  async function addToCollection(listId: string, listName: string, note: string) {
    if (!authUser || !note.trim()) return;
    const username = authUser.user_metadata?.username || "";
    setAddingCollId(listId); setCollFeedback(null);
    try {
      const res = await fetch(`/api/collections/${listId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime", note: note.trim() }) });
      if (res.ok) {
        setCollFeedback(`Added to "${listName}" ✓`);
        setCollections(prev => prev.map(c => c.id === listId ? { ...c, itemCount: c.itemCount + 1 } : c));
      } else { setCollFeedback("Failed to add"); }
    } catch { setCollFeedback("Failed to add"); }
    setAddingCollId(null);
    setTimeout(() => setCollFeedback(null), 3500);
  }

  function handleRatingChange(newRating: number) {
    setRating(newRating);
    if (trackStatus === "completed" && newRating > 0) handleTrack("completed", newRating);
  }

  return (
    <div className="px-4 md:px-0">
      {mode !== "reviews-only" && mode !== "episodes-only" && (
      <>
      {/* Tracking section */}
      <div className="mt-6">
        {/* Star rating */}
        {authUser && isWatched && (
          <div className="flex justify-center md:justify-start mb-2">
            <StarInput value={rating} onChange={handleRatingChange} />
          </div>
        )}
        {isWatched && trackedAt && (
          <p className="text-[10px] text-text-secondary mb-2 text-center md:text-left">Watched {formatDate(trackedAt)}</p>
        )}

        {/* Tracking buttons */}
        {mounted && (
          <>
          {epSaveError && mode === "buttons-only" && (
            <div className="mb-3 rounded-md bg-red-500/15 px-3 py-2 text-xs text-red-400">
              Couldn&apos;t save that change — it wasn&apos;t stored. Please try again.
            </div>
          )}
          <div className="flex gap-2 justify-center md:justify-start">
            <button onClick={() => handleTrack("plan_to_watch")} disabled={trackLoading}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all border ${isWanted ? "text-[#14b8a6] border-[#14b8a640] bg-[#14b8a610]" : "text-text-secondary border-border bg-bg-card hover:text-text-primary hover:border-accent"}`}>
              <HeartIcon active={isWanted} />TO WATCH
            </button>
            <button onClick={() => handleTrack("watching")} disabled={trackLoading || (detail.daysUntil != null && detail.daysUntil > 0)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all border ${isWatching ? "text-[#14b8a6] border-[#14b8a640] bg-[#14b8a610]" : "text-text-secondary border-border bg-bg-card hover:text-text-primary hover:border-accent"}`}>
              <PlayIcon active={isWatching} />WATCHING
            </button>
            <button onClick={() => handleTrack("completed")} disabled={trackLoading || (detail.daysUntil != null && detail.daysUntil > 0)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all border ${isWatched ? "text-[#14b8a6] border-[#14b8a640] bg-[#14b8a610]" : "text-text-secondary border-border bg-bg-card hover:text-text-primary hover:border-accent"}`}>
              <CheckIcon active={isWatched} />WATCHED
            </button>
          </div>
          </>
        )}
      </div>

      {/* Add to Collection */}
      {mounted && (
        <div className="flex justify-center md:justify-start mt-2 relative" ref={dropdownRef}>
          <button onClick={() => setShowCollDropdown(!showCollDropdown)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-border bg-bg-card text-text-secondary hover:text-text-primary hover:border-accent">
            <span className="text-sm font-bold mr-0.5">+</span> Add to Collection
          </button>
          {collFeedback && <span className={`text-[12px] font-medium ml-2 self-center px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${collFeedback.includes("✓") ? "bg-green-500/15 text-green-400" : collFeedback.includes("Failed") ? "bg-red-500/15 text-red-400" : "text-accent"}`}>{collFeedback}</span>}
          {showCollDropdown && (
            <div className="absolute mt-8 w-52 bg-bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
              {activeNoteCollId ? (
                <div className="p-2.5">
                  <button onClick={() => { setActiveNoteCollId(null); setActiveNoteCollName(""); setNoteText(""); }}
                    className="text-[10px] text-text-secondary hover:text-text-primary mb-2 border-none bg-transparent cursor-pointer">← Back</button>
                  <p className="text-[11px] text-text-secondary mb-1.5">Your thought</p>
                  <div className="flex gap-1.5">
                    <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. Best anime of the season"
                      className="flex-1 px-2 py-1.5 text-xs bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-secondary outline-none focus:border-accent" autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter" && noteText.trim()) { addToCollection(activeNoteCollId, activeNoteCollName, noteText.trim()); setNoteText(""); setActiveNoteCollId(null); setActiveNoteCollName(""); setShowCollDropdown(false); } }} />
                    <button onClick={() => { if (noteText.trim()) { addToCollection(activeNoteCollId, activeNoteCollName, noteText.trim()); setNoteText(""); setActiveNoteCollId(null); setActiveNoteCollName(""); setShowCollDropdown(false); } }}
                      disabled={!noteText.trim() || addingCollId !== null}
                      className="px-2.5 py-1.5 text-xs bg-accent text-white rounded-lg font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors border-none cursor-pointer">Add</button>
                  </div>
                </div>
              ) : collections.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-text-secondary text-center">No collections yet.<a href="/library?tab=collections" className="block mt-1 text-accent hover:underline">Create one →</a></div>
              ) : (collections.map((c) => (
                <button key={c.id} onClick={() => { setActiveNoteCollId(c.id); setActiveNoteCollName(c.name); }}
                  disabled={addingCollId === c.id}
                  className="w-full text-left px-3 py-2.5 text-xs text-text-primary hover:bg-bg-surface flex justify-between items-center transition-colors disabled:opacity-50 border-none cursor-pointer">
                  <span>{c.name}</span><span className="text-[10px] text-text-secondary">{c.itemCount}</span>
                </button>
              )))}
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Episode list with tracking */}
      {mode !== "buttons-only" && mode !== "reviews-only" && episodes.length > 0 && (
        <div className="mt-6">
          {epSaveError && (
            <div className="mb-3 rounded-md bg-red-500/15 px-3 py-2 text-xs text-red-400">
              Couldn&apos;t save that change — it wasn&apos;t stored. Please tap the circle again.
            </div>
          )}
          {/* Saga tabs */}
          {sagas && (
            <div className="flex gap-1.5 mb-3 overflow-x-auto md:overflow-visible md:flex-wrap">
              <button
                onClick={() => setSelectedSaga(null)}
                className={`flex-shrink-0 md:flex-shrink px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  !selectedSaga ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"
                }`}
              >All</button>
              {sagas.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setSelectedSaga(s)}
                  className={`flex-shrink-0 md:flex-shrink px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
                    selectedSaga?.name === s.name ? "bg-accent text-white" : "bg-bg-card text-text-secondary hover:text-text-primary"
                  }`}
                >{s.name}</button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">
              Episodes · {filteredEpisodes.length}
            </h2>
            <div className="flex items-center gap-3">
              {totalPages > 1 && (
                <span className="text-[11px] text-text-secondary">
                  {(currentPage - 1) * EPISODES_PER_PAGE + 1}–{Math.min(currentPage * EPISODES_PER_PAGE, filteredEpisodes.length)}
                </span>
              )}
              {watchedCount > 0 && (
                <span className="text-xs text-text-secondary">
                  Watched {watchedCount}/{filteredEpisodes.length}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {visibleEpisodes.map((ep) => {
              const key = `1-${ep.number}`;
              const isWatchedEp = watchedEpisodes.has(key);
              const isLoading = epToggleLoading === key;
              return (
                <div
                  key={ep.number}
                  className={`flex gap-3 bg-bg-card rounded-xl p-3 transition-all ${isWatchedEp ? "opacity-50" : "hover:bg-bg-surface"}`}
                >
                  <button
                    onClick={() => toggleEpisode(ep.number)}
                    disabled={isLoading || !authUser}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-2 ${
                      isWatchedEp
                        ? "bg-accent border-accent"
                        : "border-[#3d3d5c] hover:border-accent"
                    } ${isLoading ? "animate-pulse" : ""}`}
                    title={authUser ? (isWatchedEp ? "Mark unwatched" : "Mark watched") : "Sign in to track"}
                  >
                    {isWatchedEp && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                  <div className="flex-shrink-0 w-28 md:w-36 aspect-video rounded-lg overflow-hidden bg-bg-primary relative">
                    {ep.thumbnail ? (
                      <img src={ep.thumbnail} alt={ep.title} className="w-full h-full object-cover rounded-lg" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-secondary text-xs">
                        No preview
                      </div>
                    )}
                  </div>
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
                        {stripHtml(ep.synopsis)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {filteredEpisodes.length > EPISODES_PER_PAGE && (
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
        </div>
      )}

      {/* Review section */}
      {mode !== "buttons-only" && mode !== "episodes-only" && (
      <div className="mt-8">
        <ReviewSection tmdbId={detail.id} mediaType="anime" trackStatus={trackStatus} trackVersion={trackVersion} trackRating={rating} authUser={authUser} />
      </div>
      )}
    </div>
  );
}
