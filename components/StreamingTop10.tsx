"use client";

import { useState, useRef, useEffect } from "react";

interface Top10Item {
  rank: number;
  title: string;
  score?: number;
}

const PLATFORMS: { key: string; label: string; icon: string }[] = [
  { key: "netflix", label: "Netflix", icon: "🎬" },
  { key: "disney", label: "Disney+", icon: "✨" },
  { key: "amazon", label: "Prime", icon: "📦" },
];

export function StreamingTop10() {
  const [activeTab, setActiveTab] = useState("netflix");
  const [data, setData] = useState<Record<string, Top10Item[]>>({});
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/streaming-top10")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentData = data[activeTab] || (loading ? PLACEHOLDER_DATA[activeTab] : []);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -200 : 200,
      behavior: "smooth",
    });
  };

  if (!loading && Object.keys(data).length === 0) {
    return null; // No data, hide widget
  }

  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl overflow-hidden">
      <div className="p-3 pb-0">
        <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
          <span>📺</span> Streaming Top 10
        </h3>
        <div className="flex gap-1 mb-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setActiveTab(p.key)}
              className={`flex-1 text-[10px] font-medium px-2 py-1.5 rounded-lg transition-colors ${
                activeTab === p.key
                  ? "bg-[#6366f1] text-white"
                  : "bg-[#25253a] text-[#9ca3af] hover:text-white"
              }`}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      </div>

      {currentData.length > 0 && (
        <div className="relative px-3 pb-3">
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-5 h-5 bg-[#1a1a2e]/90 border border-[#2d2d4a] rounded-full flex items-center justify-center text-[#9ca3af] hover:text-white text-[10px]"
            aria-label="Scroll left"
          >
            ‹
          </button>

          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto hide-scrollbar snap-x snap-mandatory px-3"
          >
            {currentData.map((item) => (
              <div
                key={`${activeTab}-${item.rank}`}
                className="flex-shrink-0 w-[116px] snap-start"
              >
                <div className="bg-[#25253a] rounded-lg p-2 hover:bg-[#2d2d4a] transition-colors cursor-pointer">
                  <span
                    className={`text-[10px] font-bold ${
                      item.rank === 1
                        ? "text-[#f59e0b]"
                        : item.rank === 2
                        ? "text-[#9ca3af]"
                        : item.rank === 3
                        ? "text-[#d97706]"
                        : "text-[#6b7280]"
                    }`}
                  >
                    #{item.rank}
                  </span>
                  <p className="text-[11px] text-white leading-tight mt-0.5 line-clamp-2">
                    {item.title}
                  </p>
                  {item.score !== undefined && (
                    <p className="text-[10px] text-[#6b7280] mt-1">
                      {item.score} pts
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-5 h-5 bg-[#1a1a2e]/90 border border-[#2d2d4a] rounded-full flex items-center justify-center text-[#9ca3af] hover:text-white text-[10px]"
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      )}

      <div className="px-3 pb-2">
        <p className="text-[9px] text-[#4b5563] text-right">via FlixPatrol</p>
      </div>
    </div>
  );
}

const PLACEHOLDER_DATA: Record<string, Top10Item[]> = {
  netflix: [
    { rank: 1, title: "Loading...", score: 0 },
    { rank: 2, title: "Loading...", score: 0 },
    { rank: 3, title: "Loading...", score: 0 },
    { rank: 4, title: "Loading...", score: 0 },
    { rank: 5, title: "Loading...", score: 0 },
  ],
  disney: [
    { rank: 1, title: "Loading...", score: 0 },
    { rank: 2, title: "Loading...", score: 0 },
    { rank: 3, title: "Loading...", score: 0 },
    { rank: 4, title: "Loading...", score: 0 },
    { rank: 5, title: "Loading...", score: 0 },
  ],
  amazon: [
    { rank: 1, title: "Loading...", score: 0 },
    { rank: 2, title: "Loading...", score: 0 },
    { rank: 3, title: "Loading...", score: 0 },
    { rank: 4, title: "Loading...", score: 0 },
    { rank: 5, title: "Loading...", score: 0 },
  ],
};
