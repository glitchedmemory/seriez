"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TmdbResult } from "@/lib/tmdb";
import PosterImage from "@/components/PosterImage";
import { LockKeyholeOpen } from "lucide-react";

export function HeroCard({ item, nextItem, region, isPremium }: { item: TmdbResult; nextItem?: TmdbResult; region: string; isPremium?: boolean }) {
  const router = useRouter();
  // Collections state
  const [collections, setCollections] = useState<{ id: string; name: string; itemCount: number }[]>([]);
  const [showCollDropdown, setShowCollDropdown] = useState(false);
  const [addingCollId, setAddingCollId] = useState<string | null>(null);
  const [collFeedback, setCollFeedback] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const username = localStorage.getItem("seriez-username") || "Anonymous";
    fetch(`/api/collections?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.collections) setCollections(data.collections);
      })
      .catch(() => {});
  }, []);

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

  async function addToCollection(listId: string, listName: string) {
    const note = prompt("One-line note (required):");
    if (!note || !note.trim()) return;
    const username = localStorage.getItem("seriez-username") || "Anonymous";
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
    setTimeout(() => setCollFeedback(null), 2500);
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
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f1a]/95 via-[#0f0f1a]/60 to-[#0f0f1a]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a]/90 via-transparent to-transparent" />
        </div>

        {/* Top badges */}
        <div className="absolute top-4 left-4">
          <span className="px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-semibold">
            TRENDING NOW
          </span>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
          {/* Rating */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[#f59e0b] text-sm">★ {item.rating}</span>
            <span className="text-[#9ca3af] text-xs">
              {item.year} · {item.type === "movie" ? "Movie" : item.type === "anime" ? "Anime" : "TV"}
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
              <LockKeyholeOpen className="w-4 h-4" /> Track Now
            </button>
            <button
              onClick={handlePlusClick}
              className="px-3 py-2 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors inline-flex items-center gap-1.5 border-none cursor-pointer"
            >
              +
            </button>
            {collFeedback && (
              <span className="text-[11px] text-[#6366f1]">{collFeedback}</span>
            )}
            {showCollDropdown && (
              <div className="absolute top-full mt-2 left-0 w-52 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl shadow-2xl z-50">
                {collections.length === 0 ? (
                  <div className="px-3 py-3 text-[11px] text-[#6b7280] text-center">
                    No collections yet.
                    <a href="/library?tab=collections" className="block mt-1 text-[#6366f1] hover:underline">
                      Create one →
                    </a>
                  </div>
                ) : (
                  collections.map((c) => (
                    <button
                      key={c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addToCollection(c.id, c.name);
                        setShowCollDropdown(false);
                      }}
                      disabled={addingCollId === c.id}
                      className="w-full text-left px-3 py-2.5 text-xs text-white hover:bg-[#25253a] flex justify-between items-center transition-colors disabled:opacity-50 border-none cursor-pointer"
                    >
                      <span>{c.name}</span>
                      <span className="text-[10px] text-[#6b7280]">{c.itemCount}</span>
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
            className="mt-3 mx-4 md:mx-0 flex items-center gap-3 bg-[#1a1a2e] hover:bg-[#25253a] rounded-xl p-2.5 transition-colors cursor-pointer"
          >
            <div className="flex-shrink-0 w-12 h-[72px] rounded-lg overflow-hidden bg-[#0f0f1a] relative">
              <PosterImage
                src={nextItem.poster}
                alt={nextItem.title}
                fill
                className="rounded-lg"
                sizes="48px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[#6366f1] uppercase tracking-wide font-medium">
                Tonight&apos;s Pick
              </p>
              <p className="text-sm font-semibold text-white truncate">
                {nextItem.title}
              </p>
              <p className="text-xs text-[#9ca3af]">
                {nextItem.type === "movie" ? "Movie" : nextItem.type === "anime" ? "Anime" : "TV"} · {nextItem.year} · ★ {nextItem.rating}
              </p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#6b7280] flex-shrink-0">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </a>
        ) : (
          <div className="mt-3 mx-4 md:mx-0">
            <div className="bg-[#1a1a2e] border border-dashed border-[#2d2d4a] rounded-xl flex items-center justify-center" style={{ minHeight: 100 }}>
              <div className="text-center">
                <p className="text-[10px] text-[#4b5563] uppercase tracking-[0.15em] mb-1">Advertisement</p>
                <p className="text-xs text-[#6b7280]">AdSense · 320×100</p>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
