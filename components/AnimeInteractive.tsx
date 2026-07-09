"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AnimeDetail, AnimeEpisode } from "@/lib/anilist";
import { ReviewSection } from "@/components/ReviewSection";
import { StarInput } from "@/components/StarInput";
import { createClient } from "@/lib/supabase/client";

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

export default function AnimeInteractive({ detail, episodes }: { detail: AnimeDetail; episodes: AnimeEpisode[] }) {
  const [trackStatus, setTrackStatus] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [trackVersion, setTrackVersion] = useState(0);
  const [trackedAt, setTrackedAt] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authUser, setAuthUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
  const [epToggleLoading, setEpToggleLoading] = useState<string | null>(null);
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
  const totalPages = Math.ceil(episodes.length / EPISODES_PER_PAGE);
  const visibleEpisodes = episodes.slice((currentPage - 1) * EPISODES_PER_PAGE, currentPage * EPISODES_PER_PAGE);
  const supabase = createClient();
  const router = useRouter();

  const isWanted = trackStatus === "plan_to_watch";
  const isWatching = trackStatus === "watching";
  const isWatched = trackStatus === "completed";
  const watchedCount = episodes.filter((ep) => watchedEpisodes.has(`1-${ep.number}`)).length;

  // Fetch tracking + collections on mount
  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      const uname = session?.user?.user_metadata?.username || localStorage.getItem("seriez-username");
      if (!uname) return;
      const username = uname;
      fetch(`/api/track?username=${encodeURIComponent(username)}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const match = data.find((t: any) => t.tmdbId === detail.id && t.mediaType === "anime");
            if (match) { setTrackStatus(match.status); setRating(match.rating || 0); setTrackedAt(match.updatedAt || null); }
          }
        }).catch(() => {});
      fetch(`/api/episodes?username=${encodeURIComponent(username)}&tmdbId=${detail.id}`)
        .then((r) => r.json())
        .then((epData) => {
          if (epData.episodes) {
            const set = new Set<string>();
            epData.episodes.forEach((ep: any) => set.add(`${ep.seasonNumber}-${ep.episodeNumber}`));
            setWatchedEpisodes(set);
          }
        }).catch(() => {});
      fetch(`/api/collections?username=${encodeURIComponent(username)}`)
        .then((r) => r.json())
        .then((data) => { if (data.collections) setCollections(data.collections); }).catch(() => {});
    }).catch(() => {});
  }, [detail.id]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowCollDropdown(false);
    }
    if (showCollDropdown) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCollDropdown]);

  async function handleTrack(status: string, ratingOverride?: number) {
    if (!authUser) { router.push("/signup"); return; }
    const username = authUser.user_metadata?.username || "";
    const effectiveRating = ratingOverride ?? rating;
    const newStatus = (trackStatus === status && !ratingOverride) ? null : status;
    setTrackLoading(true);
    try {
      if (newStatus) {
        const body: Record<string, unknown> = { username, tmdbId: detail.id, mediaType: "anime", status: newStatus };
        if (status === "completed" && effectiveRating > 0) body.rating = effectiveRating;
        const res = await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const json = await res.json();
        setTrackedAt(json.updatedAt || new Date().toISOString());
        if (newStatus === "completed" && trackStatus !== "completed" && episodes.length > 0) {
          setWatchedEpisodes((prev) => { const all = new Set(prev); episodes.forEach((ep) => all.add(`1-${ep.number}`)); return all; });
          episodes.forEach((ep) => fetch("/api/episodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId: detail.id, seasonNumber: 1, episodeNumber: ep.number }) }).catch(() => {}));
        }
        if (newStatus === "watching" && !watchedEpisodes.has("1-1")) {
          setWatchedEpisodes((prev) => { const next = new Set(prev); next.add("1-1"); return next; });
          fetch("/api/episodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId: detail.id, seasonNumber: 1, episodeNumber: 1 }) }).catch(() => {});
        }
      } else {
        await fetch("/api/track", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime" }) });
        setTrackedAt(null);
        if ((trackStatus === "watching" || trackStatus === "completed") && watchedEpisodes.size > 0) {
          setWatchedEpisodes(new Set());
          for (const key of watchedEpisodes) { const [, en] = key.split("-").map(Number); fetch("/api/episodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId: detail.id, seasonNumber: 1, episodeNumber: en }) }).catch(() => {}); }
        }
      }
      setTrackStatus(newStatus);
      setTrackVersion(v => v + 1);
    } catch {}
    setTrackLoading(false);
  }

  async function toggleEpisode(episodeNumber: number) {
    if (!authUser) return;
    const key = `1-${episodeNumber}`;
    const username = authUser.user_metadata?.username || "";
    const wasWatched = watchedEpisodes.has(key);
    setWatchedEpisodes((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
    setEpToggleLoading(key);
    const willHaveWatched = !wasWatched || watchedEpisodes.size > 1;
    if (willHaveWatched && !trackStatus) {
      setTrackStatus("watching");
      await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime", status: "watching" }) });
    } else if (!willHaveWatched && trackStatus === "watching") {
      setTrackStatus(null);
      await fetch("/api/track", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime" }) });
    }
    try { await fetch("/api/episodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId: detail.id, seasonNumber: 1, episodeNumber }) }); } catch {}
    setEpToggleLoading(null);
    if (trackStatus === "completed" && wasWatched && watchedEpisodes.size - 1 < episodes.length) {
      setTrackStatus("watching");
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime", status: "watching" }) }).catch(() => {});
    }
    const nowAllWatched = !wasWatched && watchedEpisodes.size + 1 >= episodes.length;
    if (nowAllWatched && trackStatus !== "completed") {
      setTrackStatus("completed");
      setTrackedAt(new Date().toISOString());
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId: detail.id, mediaType: "anime", status: "completed" }) }).catch(() => {});
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
          <div className="flex gap-2 justify-center md:justify-start">
            <button onClick={() => handleTrack("plan_to_watch")} disabled={trackLoading}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all"
              style={{ color: isWanted ? "#14b8a6" : "var(--color-text-secondary)", backgroundColor: isWanted ? "#14b8a610" : "var(--color-bg-card)", border: isWanted ? "1px solid #14b8a640" : "1px solid var(--color-border)" }}>
              <HeartIcon active={isWanted} />TO WATCH
            </button>
            <button onClick={() => handleTrack("watching")} disabled={trackLoading || (detail.daysUntil != null && detail.daysUntil > 0)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all"
              style={{ color: isWatching ? "#14b8a6" : "var(--color-text-secondary)", backgroundColor: isWatching ? "#14b8a610" : "var(--color-bg-card)", border: isWatching ? "1px solid #14b8a640" : "1px solid var(--color-border)" }}>
              <PlayIcon active={isWatching} />WATCHING
            </button>
            <button onClick={() => handleTrack("completed")} disabled={trackLoading || (detail.daysUntil != null && detail.daysUntil > 0)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all"
              style={{ color: isWatched ? "#14b8a6" : "var(--color-text-secondary)", backgroundColor: isWatched ? "#14b8a610" : "var(--color-bg-card)", border: isWatched ? "1px solid #14b8a640" : "1px solid var(--color-border)" }}>
              <CheckIcon active={isWatched} />WATCHED
            </button>
          </div>
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

      {/* Episode list with tracking */}
      {episodes.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">Episodes · {episodes.length}</h2>
            {mounted && authUser && trackStatus && (
              <button onClick={() => {
                if (watchedCount >= episodes.length) { setWatchedEpisodes(new Set()); episodes.forEach(ep => fetch("/api/episodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: authUser.user_metadata?.username, tmdbId: detail.id, seasonNumber: 1, episodeNumber: ep.number }) }).catch(() => {})); }
                else { setWatchedEpisodes(new Set(episodes.map(ep => `1-${ep.number}`))); episodes.forEach(ep => fetch("/api/episodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: authUser.user_metadata?.username, tmdbId: detail.id, seasonNumber: 1, episodeNumber: ep.number }) }).catch(() => {})); }
              }} disabled={!authUser}
                className="text-xs text-accent hover:underline border-none bg-transparent cursor-pointer">
                {watchedCount >= episodes.length ? "Uncheck all" : `Mark all (${watchedCount}/${episodes.length})`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {visibleEpisodes.map((ep) => {
              const key = `1-${ep.number}`;
              const isWatchedEp = watchedEpisodes.has(key);
              const isLoading = epToggleLoading === key;
              return (
                <div key={ep.number} className={`flex items-start gap-3 rounded-xl p-3 transition-colors border ${isWatchedEp ? "bg-accent/5 border-accent/30" : "bg-bg-card border-border"}`}>
                  <button onClick={() => toggleEpisode(ep.number)} disabled={!authUser || isLoading}
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mt-1 ${isWatchedEp ? "bg-accent border-accent text-white" : "border-text-secondary/30 bg-transparent"} ${authUser ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
                    {isWatchedEp ? "✓" : ""}
                  </button>
                  {ep.thumbnail ? (
                    <img src={ep.thumbnail} alt={ep.title} className="w-24 h-14 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                  ) : (
                    <div className="w-24 h-14 rounded-lg bg-bg-surface flex-shrink-0 flex items-center justify-center text-text-secondary text-[10px]">Ep {ep.number}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-accent">{ep.number}</span>
                      <h3 className="text-xs font-medium text-text-primary truncate">{ep.title}</h3>
                    </div>
                    {ep.titleJapanese && <p className="text-[10px] text-text-secondary mt-0.5 line-clamp-1">{ep.titleJapanese}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[9px] text-text-secondary">
                      {ep.airDate && <span>{formatDate(ep.airDate)}</span>}
                      {ep.duration > 0 && <span>{ep.duration}m</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex gap-1 mt-4 justify-center">
              <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}
                className="px-2 py-1 text-[10px] bg-bg-card border border-border rounded text-text-secondary hover:text-text-primary disabled:opacity-30">← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)}
                  className={`px-2 py-1 text-[10px] border rounded ${currentPage === i + 1 ? "bg-accent text-white border-accent" : "bg-bg-card border-border text-text-secondary hover:text-text-primary"}`}>{i + 1}</button>
              ))}
              <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}
                className="px-2 py-1 text-[10px] bg-bg-card border border-border rounded text-text-secondary hover:text-text-primary disabled:opacity-30">Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Review section */}
      <div className="mt-8">
        <ReviewSection tmdbId={detail.id} mediaType="anime" trackStatus={trackStatus} trackVersion={trackVersion} trackRating={rating} authUser={authUser} />
      </div>
    </div>
  );
}
