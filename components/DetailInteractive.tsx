"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ReviewSection } from "@/components/ReviewSection";
import { StarInput } from "@/components/StarInput";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

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
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

interface DetailData {
  id: number;
  type: "movie" | "tv";
  daysUntil?: number | null;
}

export default function DetailInteractive({ detail, mode }: { detail: DetailData; mode?: "buttons-only" | "reviews-only" }) {
  const t = useTranslations();
  const [trackStatus, setTrackStatus] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [trackVersion, setTrackVersion] = useState(0);
  const [trackedAt, setTrackedAt] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authUser, setAuthUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const [collections, setCollections] = useState<{ id: string; name: string; itemCount: number }[]>([]);
  const [showCollDropdown, setShowCollDropdown] = useState(false);
  const [addingCollId, setAddingCollId] = useState<string | null>(null);
  const [collFeedback, setCollFeedback] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [activeNoteCollId, setActiveNoteCollId] = useState<string | null>(null);
  const [activeNoteCollName, setActiveNoteCollName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      const uname = session?.user?.user_metadata?.username || localStorage.getItem("seriez-username");
      if (!uname) return;
      const username = uname;

    fetch(`/api/track?username=${encodeURIComponent(username)}`, { cache: "no-cache" })
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

    fetch(`/api/collections?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.collections) setCollections(data.collections);
      })
      .catch(() => {});
    }).catch(() => {});
  }, [detail.id, detail.type]);

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
    if (!authUser) { router.push("/signup"); return; }
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
    <>
      {mode !== "reviews-only" && (
      <>
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

      {mounted && (
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
                  <button onClick={() => { setActiveNoteCollId(null); setActiveNoteCollName(""); setNoteText(""); }}
                    className="text-[10px] text-text-secondary hover:text-text-primary mb-2 border-none bg-transparent cursor-pointer">← Back</button>
                  <p className="text-[11px] text-text-secondary mb-1.5">Your thought</p>
                  <div className="flex gap-1.5">
                    <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
                      placeholder="e.g. Best action movie of 2025"
                      className="flex-1 px-2 py-1.5 text-xs bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-secondary outline-none focus:border-accent"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && noteText.trim()) {
                          addToCollection(activeNoteCollId, activeNoteCollName, noteText.trim());
                          setNoteText(""); setActiveNoteCollId(null); setActiveNoteCollName(""); setShowCollDropdown(false);
                        }
                      }}
                    />
                    <button onClick={() => {
                        if (noteText.trim()) {
                          addToCollection(activeNoteCollId, activeNoteCollName, noteText.trim());
                          setNoteText(""); setActiveNoteCollId(null); setActiveNoteCollName(""); setShowCollDropdown(false);
                        }
                      }}
                      disabled={!noteText.trim() || addingCollId !== null}
                      className="px-2.5 py-1.5 text-xs bg-accent text-white rounded-lg font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors border-none cursor-pointer">Add</button>
                  </div>
                </div>
              ) : collections.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-text-secondary text-center">
                  No collections yet.
                  <a href="/library?tab=collections" className="block mt-1 text-accent hover:underline">Create one →</a>
                </div>
              ) : (
                collections.map((c) => (
                  <button key={c.id} onClick={() => { setActiveNoteCollId(c.id); setActiveNoteCollName(c.name); }}
                    disabled={addingCollId === c.id}
                    className="w-full text-left px-3 py-2.5 text-xs text-text-primary hover:bg-bg-surface flex justify-between items-center transition-colors disabled:opacity-50 border-none cursor-pointer">
                    <span>{c.name}</span>
                    <span className="text-[10px] text-text-secondary">{c.itemCount}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
      </>
      )}

      {mode !== "buttons-only" && (
      <section className="mt-6">
        <ReviewSection tmdbId={detail.id} mediaType={detail.type} trackStatus={trackStatus} trackVersion={trackVersion} trackRating={rating} authUser={authUser} />
      </section>
      )}
    </>
  );
}
