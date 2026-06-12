"use client";

import Image from "next/image";
import Link from "next/link";

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";

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
  monthlyView?: boolean;
}

export default function WatchList({ items, monthlyView }: WatchListProps) {
  const sorted = [...items].sort((a, b) => b.rating - a.rating);
  const displayItems = sorted.slice(0, 10);

  if (displayItems.length === 0) {
    return (
      <div className="px-4 flex flex-col items-center py-12 text-center">
        <span className="text-3xl mb-3">📋</span>
        <p className="text-[#9ca3af] text-sm">No watches yet this month</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      <h2 className="text-[15px] font-bold text-white tracking-tight mb-3">
        This Month&apos;s Diary
      </h2>
      <div className="divide-y divide-[#1a1a2e]">
        {displayItems.map((item) => (
          <Link
            key={item.tmdbId}
            href={`/title/${item.tmdbId}?type=${item.mediaType}`}
            className="flex gap-3 py-3 items-center hover:bg-[#1a1a2e]/50 transition-colors -mx-1 px-1 rounded-lg"
          >
            {/* Poster */}
            <div className="w-12 h-[68px] flex-shrink-0 rounded-md overflow-hidden bg-[#1a1a2e]">
              {item.posterPath ? (
                <Image
                  src={`${TMDB_IMAGE}${item.posterPath}`}
                  alt={item.title}
                  width={48}
                  height={72}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center">
                  <span className="text-white/60 text-[9px] font-semibold text-center px-1">
                    {item.title.slice(0, 4)}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate tracking-tight">
                {item.title}
              </p>
              <p className="text-xs text-[#9ca3af] font-medium mt-0.5">
                {new Date(item.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* Stars */}
            {item.rating > 0 && (
              <span className="text-sm font-bold text-[#f59e0b] flex-shrink-0">
                ★ {item.rating}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
