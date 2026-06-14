"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PosterImage from "@/components/PosterImage";

interface Activity {
  id: string;
  type: "review" | "rated" | "watched" | "watching" | "plan_to_watch";
  username: string;
  tmdbId: number;
  mediaType: string;
  title: string;
  poster: string | null;
  year: string | null;
  rating?: number;
  content?: string;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  review: "📝",
  rated: "⭐",
  watched: "✅",
  watching: "👁️",
  plan_to_watch: "📌",
};

const TYPE_TEXT: Record<string, string> = {
  review: "reviewed",
  rated: "rated",
  watched: "watched",
  watching: "is watching",
  plan_to_watch: "plans to watch",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function FeedPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setActivities(data.activities || []);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-lg md:max-w-2xl mx-auto min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-[#0f0f1a]/95 backdrop-blur-md px-4 py-3 border-b border-[#1a1a2e]">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
          Feed
        </h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="px-4 mt-10 text-center">
          <span className="text-4xl mb-3 block">📭</span>
          <p className="text-[#6b7280] text-sm">{error}</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="px-4 mt-10 text-center">
          <span className="text-4xl mb-3 block">🔔</span>
          <h2 className="text-white text-lg font-bold mb-2">No activity yet</h2>
          <p className="text-[#6b7280] text-sm">
            Follow other users to see their activity here.
          </p>
        </div>
      ) : (
        <div className="px-4 mt-4 space-y-1">
          {activities.map((a) => (
            <Link
              key={a.id}
              href={`/title/${a.tmdbId}?type=${a.mediaType}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1a1a2e] transition-colors group"
            >
              {/* Poster */}
              <div className="w-10 h-[60px] rounded-lg overflow-hidden bg-[#1a1a2e] flex-shrink-0 relative">
                {a.poster ? (
                  <PosterImage src={a.poster} alt="" fill className="rounded-lg" sizes="40px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10 text-lg font-bold">
                    {a.title.slice(0, 1)}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">{TYPE_ICON[a.type] || "📌"}</span>
                  <p className="text-[13px] text-white leading-tight truncate">
                    <span className="font-semibold text-[#a855f7]">{a.username}</span>{" "}
                    <span className="text-[#9ca3af]">{TYPE_TEXT[a.type] || "tracked"}</span>{" "}
                    <span className="font-medium group-hover:text-[#6366f1] transition-colors">
                      {a.title}
                    </span>
                  </p>
                </div>

                {/* Rating badge */}
                <div className="flex items-center gap-2 mt-0.5">
                  {a.rating && a.rating > 0 && (
                    <span className="text-[11px] text-[#f59e0b] font-medium">
                      ★ {a.rating}
                    </span>
                  )}
                  {a.year && (
                    <span className="text-[11px] text-[#6b7280]">{a.year}</span>
                  )}
                  <span className="text-[11px] text-[#4b5563]">{timeAgo(a.createdAt)}</span>
                </div>

                {/* Review snippet */}
                {a.content && (
                  <p className="text-[11px] text-[#6b7280] mt-1 line-clamp-2 italic">
                    &ldquo;{a.content}&rdquo;
                  </p>
                )}
              </div>

              {/* Arrow */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-[#2d2d4a] group-hover:text-[#6366f1] flex-shrink-0 transition-colors"
              >
                <path
                  fillRule="evenodd"
                  d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
