"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w185";

export interface DayEntry {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  mediaType: string;
  rating: number;
  runtime: number | null;
  episodeCount: number;
}

interface DayPopupProps {
  date: string;
  entries: DayEntry[];
  onClose: () => void;
}

function formatRuntime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function DayPopup({ date, entries, onClose }: DayPopupProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Total runtime
  const totalMinutes = entries.reduce((sum, e) => {
    if (e.runtime) return sum + e.runtime * e.episodeCount;
    // fallback estimates
    if (e.mediaType === "movie") return sum + 120;
    if (e.mediaType === "anime") return sum + 24 * e.episodeCount;
    return sum + 45 * e.episodeCount;
  }, 0);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Popup */}
      <div className="relative w-full max-w-md bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d2d4a]">
          <h3 className="text-white font-semibold text-sm">
            {formatDate(date)}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#2d2d4a] text-[#9ca3af] hover:bg-[#3d3d5a] hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Poster row */}
        <div className="px-5 py-4">
          <div className="flex gap-3 justify-center flex-wrap">
            {entries.slice(0, 5).map((entry) => (
              <Link
                key={entry.tmdbId}
                href={`/title/${entry.tmdbId}`}
                className="flex flex-col items-center gap-2 group w-[88px]"
              >
                <div className="w-[80px] aspect-[2/3] rounded-lg overflow-hidden bg-[#0f0f1a] relative shadow-lg group-hover:ring-2 ring-[#6366f1] transition-all">
                  {entry.posterPath ? (
                    <Image
                      src={`${TMDB_IMAGE}${entry.posterPath}`}
                      alt={entry.title}
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center p-1">
                      <span className="text-white/60 text-[9px] font-semibold text-center leading-tight">
                        {entry.title}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-center w-full">
                  <p className="text-white text-[11px] font-medium truncate leading-tight max-w-[80px]">
                    {entry.title}
                  </p>
                  {entry.rating > 0 && (
                    <p className="text-[#f59e0b] text-[10px] mt-0.5">
                      ★ {entry.rating}
                    </p>
                  )}
                  {entry.runtime && (
                    <p className="text-[#6b7280] text-[10px]">
                      {entry.mediaType === "movie"
                        ? formatRuntime(entry.runtime)
                        : `${entry.runtime}m × ${entry.episodeCount}`}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Total time */}
        <div className="px-5 py-3 border-t border-[#2d2d4a] bg-[#0f0f1a]/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#6b7280]">Total watch time</span>
            <span className="text-white font-semibold">
              {formatRuntime(totalMinutes)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
