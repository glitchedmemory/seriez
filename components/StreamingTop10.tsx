"use client";

import { useState, useEffect } from "react";

interface Top10Item {
  rank: number;
  title: string;
  score: number;
  tmdbId?: number;
  poster?: string;
  mediaType?: string;
}

const PLATFORMS: {
  key: string;
  label: string;
  icon: string;
  color: string;
}[] = [
  { key: "netflix", label: "Netflix", icon: "/icons/platforms/netflix.svg", color: "#E50914" },
  { key: "disney", label: "Disney+", icon: "/icons/platforms/disney-plus.svg", color: "#113CCF" },
  { key: "amazon", label: "Prime", icon: "/icons/platforms/prime-video.svg", color: "#00A8E1" },
];

export function StreamingTop10({ variant }: { variant?: "sidebar" | "page" }) {
  const [activeTab, setActiveTab] = useState("netflix");
  const [data, setData] = useState<Record<string, Top10Item[]>>({});
  const [loading, setLoading] = useState(true);

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
  const activeColor = PLATFORMS.find((p) => p.key === activeTab)?.color || "#6366f1";

  if (!loading && Object.keys(data).length === 0) return null;

  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl overflow-hidden">
      <div className="p-3">
        <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
          <span>📺</span> Streaming Top 10
        </h3>

        {/* Tabs with brand logos */}
        <div className="flex gap-1 mb-3">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setActiveTab(p.key)}
              className="flex-1 flex items-center justify-center px-2 py-2 rounded-lg transition-colors"
              style={{
                backgroundColor: activeTab === p.key ? p.color + "22" : "transparent",
                outline: activeTab === p.key ? `2px solid ${p.color}` : "none",
                outlineOffset: -2,
              }}
              onMouseEnter={(e) => {
                if (activeTab !== p.key)
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#25253a";
              }}
              onMouseLeave={(e) => {
                if (activeTab !== p.key)
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <img
                src={p.icon}
                alt={p.label}
                className="h-4 w-auto"
                style={{
                  filter: activeTab === p.key ? "none" : "grayscale(100%) brightness(0.5)",
                }}
              />
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-0.5">
          {currentData.map((item) => (
            <a
              key={`${activeTab}-${item.rank}`}
              href={item.tmdbId ? `/title/${item.tmdbId}?type=${item.mediaType || "movie"}` : "#"}
              onClick={(e) => {
                if (!item.tmdbId) e.preventDefault();
              }}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-[#25253a] cursor-pointer"
            >
              <span
                className="text-[11px] font-bold w-4 text-right flex-shrink-0"
                style={{
                  color:
                    item.rank === 1
                      ? activeColor
                      : item.rank === 2
                      ? "#9ca3af"
                      : item.rank === 3
                      ? "#d97706"
                      : "#6b7280",
                }}
              >
                {item.rank}
              </span>

              {item.poster ? (
                <img
                  src={item.poster}
                  alt=""
                  className="w-6 h-9 rounded object-cover flex-shrink-0 bg-[#0f0f1a]"
                  loading="lazy"
                />
              ) : (
                <div className="w-6 h-9 rounded bg-[#0f0f1a] flex-shrink-0 flex items-center justify-center">
                  <span className="text-[8px] text-[#4b5563]">—</span>
                </div>
              )}

              <span className="text-[12px] text-white truncate">{item.title}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

const PLACEHOLDER_DATA: Record<string, Top10Item[]> = {
  netflix: Array.from({ length: 5 }, (_, i) => ({
    rank: i + 1,
    title: "Loading...",
    score: 0,
  })),
  disney: Array.from({ length: 5 }, (_, i) => ({
    rank: i + 1,
    title: "Loading...",
    score: 0,
  })),
  amazon: Array.from({ length: 5 }, (_, i) => ({
    rank: i + 1,
    title: "Loading...",
    score: 0,
  })),
};
