"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { TmdbResult } from "@/lib/tmdb";
import { createClient } from "@/lib/supabase/client";
import PosterImage from "@/components/PosterImage";
import { LockKeyholeOpen } from "lucide-react";

export function HeroCard({ item, nextItem, region, isPremium }: { item: TmdbResult; nextItem?: TmdbResult; region: string; isPremium?: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createClient();
  // Collections state
  const [collections, setCollections] = useState<{ id: string; name: string; itemCount: number }[]>([]);
  const [showCollDropdown, setShowCollDropdown] = useState(false);
  const [addingCollId, setAddingCollId] = useState<string | null>(null);
  const [collFeedback, setCollFeedback] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [activeNoteCollId, setActiveNoteCollId] = useState<string | null>(null);
  const [activeNoteCollName, setActiveNoteCollName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [authUsername, setAuthUsername] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUsername(session?.user?.user_metadata?.username || null);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!authUsername) return;
    const username = authUsername;
    fetch(`/api/collections?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.collections) setCollections(data.collections);
      })
      .catch(() => {});
  }, [authUsername]);

  useEffect(() => {
    if (!showCollDropdown) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCollDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCollDropdown]);

  async function addToCollection(listId: string, listName: string, note: string) {
    if (!authUsername) return;
    const username = authUsername;
    setAddingCollId(listId);
    setCollFeedback(null);
    try {
      const res = await fetch(`/api/collections/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tmdbId: item.id, mediaType: item.type, note: note.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setCollFeedback(`Added to "${listName}" ✓`);
        setCollections((prev) => prev.map((c) => (c.id === listId ? { ...c, itemCount: c.itemCount + 1 } : c)));
      } else {
        setCollFeedback(json.error || "Failed to add");
      }
    } catch {
      setCollFeedback("Failed to add");
    }
    setAddingCollId(null);
    setTimeout(() => setCollFeedback(null), 3500);
  }

  function handleWatchNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = item.type === "tv"
      ? `/title/${item.id}/season/1`
      : `/title/${item.id}?type=${item.type}`;
    router.push(url);
  }

  function handlePlusClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (collections.length === 0) {
      router.push("/library");
      return;
    }
    setShowCollDropdown(!showCollDropdown);
  }

  return (
    <div className="px-0 pt-0 pb-2">
      {/* Main Hero */}
      <a
        href={`/title/${item.id}?type=${item.type}`}
        className="relative block rounded-none md:rounded-2xl min-h-[280px] md:min-h-[340px] group cursor-pointer"
      >
        {/* Backdrop background */}
        <div className="absolute inset-0 overflow-hidden rounded-none md:rounded-2xl">
        <div className="relative w-full h-full">
        <PosterImage
          src={item.backdrop}
          alt=""
          fill
          className="rounded-none md:rounded-2xl group-hover:scale-105 transition-transform duration-700"
          priority
          unoptimized
        />
        </div>

        {/* Dark overlay gradient - left side darker for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-bg-primary/95 via-[#0f0f1a]/60 to-bg-primary/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 via-transparent to-transparent" />
        </div>

        {/* Top badges */}
        <div className="absolute top-4 left-4">
          <span className="px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-semibold">
            {t("home.trendingNow")}
          </span>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
          {/* Rating */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gold text-sm">★ {item.rating}</span>
            <span className="text-white/60 text-xs">
              {item.year} · {item.type === "movie" ? t("common.movie") : item.type === "anime" ? t("common.anime") : t("common.tv")}
            </span>
            {item.genres.slice(0, 3).map((g) => (
              <span key={g} className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/80">
                {g}
              </span>
            ))}
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-2">
            {item.title}
          </h2>

          {/* Synopsis */}
          {item.overview && (
            <p className="text-sm text-white/70 leading-relaxed mb-4 max-w-lg line-clamp-2">
              {item.overview}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 items-center relative" ref={dropdownRef}>
            <button
              onClick={handleWatchNow}
              className="px-5 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-200 transition-colors inline-flex items-center gap-1.5 border-none cursor-pointer"
            >
              <LockKeyholeOpen className="w-4 h-4" /> {t("tracking.watchNow")}
            </button>
            <button
              onClick={handlePlusClick}
              className="px-3 py-2 rounded-full bg-white/10 text-text-primary text-sm font-medium hover:bg-white/20 transition-colors inline-flex items-center gap-1.5 border-none cursor-pointer"
            >
              +
            </button>
            {collFeedback && (
              <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                collFeedback.includes("✓") ? "bg-green-500/15 text-green-400" :
                collFeedback.includes("Failed") ? "bg-red-500/15 text-red-400" :
                "text-accent"
              }`}>{collFeedback}</span>
            )}
            {showCollDropdown && (
              <div className="absolute top-full mt-2 left-0 w-52 bg-bg-card border border-border rounded-xl shadow-2xl z-50">
                {activeNoteCollId ? (
                  <div className="p-2.5">
                    <button
                      onClick={() => { setActiveNoteCollId(null); setActiveNoteCollName(""); setNoteText(""); }}
                      className="text-[10px] text-text-secondary hover:text-text-primary mb-2 border-none bg-transparent cursor-pointer"
                    >
                      ← {t("common.back")}
                    </button>
                    <p className="text-[11px] text-text-secondary mb-1.5">{t("collections.yourThought")}</p>
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
                        {t("collections.add")}
                      </button>
                    </div>
                  </div>
                ) : (
                  collections.map((c) => (
                    <button
                      key={c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveNoteCollId(c.id);
                        setActiveNoteCollName(c.name);
                      }}
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
        </div>
      </a>

      {/* Tonight's Pick (premium) or Ad (free) */}
      {nextItem && (
        isPremium ? (
          <a
            href={`/title/${nextItem.id}?type=${nextItem.type}`}
            className="mt-3 mx-4 md:mx-0 flex items-center gap-3 bg-bg-card hover:bg-bg-surface rounded-xl p-2.5 transition-colors cursor-pointer"
          >
            <div className="flex-shrink-0 w-12 h-[72px] rounded-lg overflow-hidden bg-bg-primary relative">
              <PosterImage
                src={nextItem.poster}
                alt={nextItem.title}
                fill
                className="rounded-lg"
                sizes="48px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-accent uppercase tracking-wide font-medium">
                {t("home.tonightsPick")}
              </p>
              <p className="text-sm font-semibold text-text-primary truncate">
                {nextItem.title}
              </p>
              <p className="text-xs text-text-secondary">
                {nextItem.type === "movie" ? t("common.movie") : nextItem.type === "anime" ? t("common.anime") : t("common.tv")} · {nextItem.year} · ★ {nextItem.rating}
              </p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-text-secondary flex-shrink-0">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </a>
        ) : (
          <a href="/signup" className="mt-3 mx-4 md:mx-0 block bg-bg-card rounded-xl overflow-hidden hover:ring-1 hover:ring-accent/30 transition-all" style={{ minHeight: 100 }}>
            <img
              src="/seriez-banner.jpg?v=3"
              alt="Seriez — Never lose track of what to watch"
              className="w-full h-auto block object-contain mx-auto md:hidden"
              style={{ maxHeight: 100 }}
            />
            <img
              src="/seriez-banner-desktop.jpg?v=2"
              alt="Seriez — Never lose track of what to watch"
              className="w-full h-auto hidden md:block object-contain mx-auto"
              style={{ maxHeight: 100 }}
            />
          </a>
        )
      )}
    </div>
  );
}
