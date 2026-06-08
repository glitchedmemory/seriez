"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w185";

export interface WatchListItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  mediaType: string;
  status: string;
  rating: number;
  updatedAt: string;
}

interface WatchListProps {
  items: WatchListItem[];
}

type SortMode = "recent" | "rated";

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  watching: "Watching",
  plan_to_watch: "Plan to Watch",
  on_hold: "On Hold",
  dropped: "Dropped",
};

export default function WatchList({ items }: WatchListProps) {
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const sorted = [...items].sort((a, b) => {
    if (sortMode === "rated") {
      return (b.rating || 0) - (a.rating || 0);
    }
    return (
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  });

  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl overflow-hidden">
      {/* Tab header */}
      <div className="flex border-b border-[#2d2d4a]">
        <button
          onClick={() => setSortMode("recent")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            sortMode === "recent"
              ? "text-white border-b-2 border-[#6366f1]"
              : "text-[#6b7280] hover:text-[#9ca3af]"
          }`}
        >
          Recent
        </button>
        <button
          onClick={() => setSortMode("rated")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            sortMode === "rated"
              ? "text-white border-b-2 border-[#6366f1]"
              : "text-[#6b7280] hover:text-[#9ca3af]"
          }`}
        >
          Highest Rated
        </button>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <span className="text-3xl mb-3">📋</span>
          <p className="text-[#6b7280] text-sm">No watches yet</p>
        </div>
      ) : (
        <div className="divide-y divide-[#2d2d4a]">
          {sorted.map((item) => (
            <Link
              key={item.tmdbId}
              href={`/title/${item.tmdbId}`}
              className="flex gap-3 p-3 hover:bg-[#1e1e35] transition-colors group"
            >
              {/* Poster */}
              <div className="w-10 flex-shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-[#0f0f1a]">
                {item.posterPath ? (
                  <Image
                    src={`${TMDB_IMAGE}${item.posterPath}`}
                    alt={item.title}
                    width={40}
                    height={60}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center">
                    <span className="text-white/50 text-[7px] font-semibold text-center px-0.5">
                      {item.title.slice(0, 3)}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate group-hover:text-[#818cf8] transition-colors">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.rating > 0 && (
                    <span className="text-[#f59e0b] text-xs">
                      ★ {item.rating}
                    </span>
                  )}
                  <span className="text-[#6b7280] text-[11px]">
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                </div>
                <p className="text-[#4b5563] text-[10px] mt-0.5">
                  {new Date(item.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
