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

// Inline SVG brand logos — no cache issues, always up to date
function NetflixLogo() {
  return (
    <svg viewBox="0 0 200 40" className="h-5 w-auto" fill="none">
      <rect width="200" height="40" rx="6" fill="#E50914"/>
      <text x="100" y="27" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontSize="22" fontWeight="900" fill="white" letterSpacing="3">NETFLIX</text>
    </svg>
  );
}

function DisneyLogo() {
  return (
    <svg viewBox="0 0 200 40" className="h-5 w-auto" fill="none">
      <rect width="200" height="40" rx="6" fill="#113CCF"/>
      <text x="100" y="27" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontSize="18" fontWeight="900" fill="white" letterSpacing="2">DISNEY+</text>
    </svg>
  );
}

function PrimeLogo() {
  return (
    <svg viewBox="0 0 200 40" className="h-5 w-auto" fill="none">
      <rect width="200" height="40" rx="6" fill="#00A8E1"/>
      <text x="100" y="22" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontSize="11" fontWeight="700" fill="white" letterSpacing="1">prime video</text>
      <path d="M103 24 L99 30 L107 30 Z" fill="white"/>
    </svg>
  );
}

const PLATFORMS: {
  key: string;
  label: string;
  color: string;
  Logo: React.ComponentType;
}[] = [
  { key: "netflix", label: "Netflix", color: "#E50914", Logo: NetflixLogo },
  { key: "disney", label: "Disney+", color: "#113CCF", Logo: DisneyLogo },
  { key: "amazon", label: "Prime", color: "#00A8E1", Logo: PrimeLogo },
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
  const activePlatform = PLATFORMS.find((p) => p.key === activeTab);
  const activeColor = activePlatform?.color || "#6366f1";

  if (!loading && Object.keys(data).length === 0) return null;

  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl overflow-hidden">
      <div className="p-3">
        <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
          <span>📺</span> Streaming Top 10
        </h3>

        {/* Tabs with inline brand logos */}
        <div className="flex gap-1 mb-3">
          {PLATFORMS.map((p) => {
            const isActive = activeTab === p.key;
            const LogoComponent = p.Logo;
            return (
              <button
                key={p.key}
                onClick={() => setActiveTab(p.key)}
                className="flex-1 flex items-center justify-center px-2 py-1.5 rounded-lg transition-all"
                style={{
                  backgroundColor: isActive ? p.color + "22" : "transparent",
                  borderBottom: isActive ? `2px solid ${p.color}` : "2px solid transparent",
                }}
              >
                <span
                  style={{
                    opacity: isActive ? 1 : 0.55,
                    filter: isActive ? "none" : "grayscale(100%)",
                  }}
                  className="leading-none"
                >
                  <LogoComponent />
                </span>
              </button>
            );
          })}
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
                  className="w-10 h-14 rounded object-cover flex-shrink-0 bg-[#1a1a2e] border border-[#2d2d4a]"
                  loading="lazy"
                  onError={(e) => {
                    // Hide broken image, show placeholder
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              {/* Fallback placeholder (shown via onError or when no poster) */}
              <div
                className={item.poster ? "hidden" : "w-10 h-14 rounded bg-[#0f0f1a] flex-shrink-0 flex items-center justify-center border border-[#2d2d4a]"}
              >
                <span className="text-[9px] text-[#4b5563]">—</span>
              </div>

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
