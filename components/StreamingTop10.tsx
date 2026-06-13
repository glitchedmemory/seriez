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

interface PlatformData {
  movies: Top10Item[];
  tv: Top10Item[];
}

// ── Official brand LOGO MARKS (not text) ──

/** Netflix "N" logo mark — iconic red fold */
function NetflixLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-auto" fill="none">
      <path fill="#E50914" d="M5.398 0l8.348 23.602c2.346.059 4.856.398 4.856.398L10.113 0zm8.489 0v9.172l4.715 13.33V0zM5.398 1.5V24c1.873-.225 2.81-.312 4.715-.398V14.83z"/>
    </svg>
  );
}

/** Disney+ logo mark — blue arc */
function DisneyLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-auto">
      <path fill="#113CCF" d="M2.96 7.303c-.44 0-.96-.058-.96-.319c0-1.839 3.238-1.918 4.618-1.918c1.799 0 4.097.558 6.055 1.258c2.979 1.08 9.016 4.678 9.016 8.795c0 3.638-3.918 5.377-7.556 5.377a20 20 0 0 1-2.918-.3c-.06.221-.1.38-.24.84a4 4 0 0 1-.7.079l-.459-.039c-.3-.36-.4-.939-.52-1.559c-1.818-1.059-2.999-1.959-3.538-2.579c-.46-.48-.98-1.12-.98-1.739c0-.319.2-.6.66-.918c.94-.7 2.139-1.08 4.098-1.421l.04-.818c.02-.2.22-2.339.68-2.739c.739.6.819 1.219.879 2.139c.02.4.04.819.1 1.259h.28c1.399 0 5.677.359 5.677 2.378c0 .48-.7 1.379-1.38 1.379a1.73 1.73 0 0 1-.879-.259c.299-.341.739-.64.859-.9c-.4-.48-2.558-1.039-4.137-1.039a4 4 0 0 0-.52.02l.02 4.378c.639.4 1.419.439 1.918.439c2.2 0 6.756-.379 6.756-3.938c0-3.518-4.497-6.236-7.855-7.515a19.5 19.5 0 0 0-7.216-1.36a6.6 6.6 0 0 0-1.639.18c-.339.08-.459.16-.459.24c0 .139.679.22.76.26a.2.2 0 0 1 .1.159a.24.24 0 0 1-.08.16c-.081 0-.26.02-.48.02m6.495 7.016c-1.978.161-4.178.361-4.178 1.06c0 .54.92 1.2 1.48 1.619a6.4 6.4 0 0 0 2.518 1.2Zm10.141-8.955a31 31 0 0 0-.038 1.567c0 .272 0 .583.009.933c-.038.176-.291.195-.418.253a1 1 0 0 1-.233-.174V5.482c0-.264.009-.535.009-.944c0-.205 0-.438-.009-.72c0-.175.029-.34.137-.729a.31.31 0 0 1 .272-.204c.223.058.447.155.525.34c-.234.691-.214 1.449-.254 2.139m-.349-.077c.389.019.856.038 1.566.038c.272 0 .584 0 .933-.009c.176.037.196.291.254.417q-.071.129-.175.234h-2.461c-.262 0-.535-.009-.942-.009c-.205 0-.439 0-.72.009c-.176.002-.341-.027-.73-.135a.32.32 0 0 1-.205-.272c.058-.224.156-.448.34-.526c.691.234 1.45.214 2.141.253Z"/>
    </svg>
  );
}

/** Amazon Prime Video logo — smile arrow + play triangle */
function PrimeLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-6 w-auto">
      <circle cx="24" cy="24" r="21.5" fill="none" stroke="#00A8E1" strokeWidth="1.5"/>
      <path fill="#00A8E1" d="M17.993 15.125l-2 5.3l-2-5.3"/><rect width="4" height="5.3" x="32.007" y="15.215" fill="none" stroke="#00A8E1" strokeWidth="1" rx="2"/>
      <circle cx="18.007" cy="12.675" r=".7" fill="#00A8E1"/>
      <path fill="none" stroke="#00A8E1" strokeWidth="1" d="M18.007 15.125v5.3m11.738-1.009a2 2 0 0 1-1.738 1.009h0a2 2 0 0 1-2-2v-1.3a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v.65h-4m-2-.65a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v1.3a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2m0 2v-8"/>
      <path fill="none" stroke="#00A8E1" strokeWidth="1" d="M32.28 24.406c1.113-.45 3.092-1.05 3.688-.327c.644.781-.17 2.477-.92 3.794"/>
      <path fill="none" stroke="#00A8E1" strokeWidth="1" d="M11.798 24.929c1.759 1.396 6.954 3.534 12.488 3.534a17 17 0 0 0 10.167-3.08"/>
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

type Category = "movies" | "tv";

export function StreamingTop10({ variant }: { variant?: "sidebar" | "page" }) {
  const [activeTab, setActiveTab] = useState("netflix");
  const [category, setCategory] = useState<Category>("movies");
  const [data, setData] = useState<Record<string, PlatformData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/streaming-top10")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        console.log("StreamingTop10 API response:", json);
        // Force-show raw data for debugging
        const raw = JSON.stringify(json?.data || {}, null, 0).substring(0, 500);
        if (json.data && Object.keys(json.data).length > 0) {
          console.log("StreamingTop10 setting data, keys:", Object.keys(json.data));
          setData(json.data);
        } else {
          console.error("StreamingTop10 empty data");
          setData({ __raw: { movies: [{ rank: 1, title: `API empty. Raw: ${raw}`, score: 0 }] as any, tv: [] } as any });
        }
      })
      .catch((e) => {
        console.error("StreamingTop10 fetch failed:", e);
        setData({ __raw: { movies: [{ rank: 1, title: `Fetch error: ${e}`, score: 0 }] as any, tv: [] } as any });
      })
      .finally(() => setLoading(false));
  }, []);

  const platformData = data[activeTab];
  const currentData: Top10Item[] = loading
    ? Array.from({ length: 5 }, (_, i) => ({ rank: i + 1, title: "Loading...", score: 0 }))
    : (platformData?.[category] || []);

  // DEBUG
  if (!loading && currentData.length === 0 && Object.keys(data).length > 0) {
    console.warn("StreamingTop10: data loaded but currentData empty", {
      activeTab, category,
      dataKeys: Object.keys(data),
      platformData,
      platformDataKeys: platformData ? Object.keys(platformData) : null,
    });
  }

  const activePlatform = PLATFORMS.find((p) => p.key === activeTab);
  const activeColor = activePlatform?.color || "#6366f1";

  if (error) {
    return (
      <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl overflow-hidden">
        <div className="p-3 text-center">
          <h3 className="text-xs font-semibold text-white mb-1">📺 Streaming Top 10</h3>
          <p className="text-[10px] text-[#6b7280]">Failed to load</p>
        </div>
      </div>
    );
  }

  if (!loading && Object.keys(data).length === 0) return null;

  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl overflow-hidden">
      <div className="p-3">
        {/* Header row: title + Movies/TV Shows toggle */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
            <span>📺</span> Streaming Top 10
          </h3>

          {/* Movies / TV Shows toggle */}
          <div className="flex rounded-lg bg-[#0f0f1a] p-0.5 border border-[#2d2d4a]">
            <button
              onClick={() => setCategory("movies")}
              className="px-2.5 py-1 text-[10px] font-medium rounded-md transition-all"
              style={{
                backgroundColor: category === "movies" ? activeColor : "transparent",
                color: category === "movies" ? "#fff" : "#6b7280",
              }}
            >
              Movies
            </button>
            <button
              onClick={() => setCategory("tv")}
              className="px-2.5 py-1 text-[10px] font-medium rounded-md transition-all"
              style={{
                backgroundColor: category === "tv" ? activeColor : "transparent",
                color: category === "tv" ? "#fff" : "#6b7280",
              }}
            >
              TV Shows
            </button>
          </div>
        </div>

        {/* Tabs with official brand logo marks */}
        <div className="flex gap-1 mb-3">
          {PLATFORMS.map((p) => {
            const isActive = activeTab === p.key;
            const LogoComponent = p.Logo;
            return (
              <button
                key={p.key}
                onClick={() => setActiveTab(p.key)}
                className="flex-1 flex items-center justify-center px-2 py-2 rounded-lg transition-all"
                style={{
                  backgroundColor: isActive ? p.color + "22" : "transparent",
                  borderBottom: isActive ? `2px solid ${p.color}` : "2px solid transparent",
                }}
              >
                <span
                  style={{
                    opacity: isActive ? 1 : 0.45,
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
              key={`${activeTab}-${category}-${item.rank}`}
              href={item.tmdbId ? `/title/${item.tmdbId}?type=${item.mediaType || category === "tv" ? "tv" : "movie"}` : "#"}
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
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
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
