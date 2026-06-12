"use client";

import { useState, useEffect } from "react";

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

  if (!loading && Object.keys(data).length === 0) {
    return null;
  }

  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl overflow-hidden">
      <div className="p-3">
        <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
          <span>📺</span> Streaming Top 10
        </h3>
        <div className="flex gap-1 mb-3">
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

        <div className="space-y-0.5">
          {currentData.map((item) => (
            <div
              key={`${activeTab}-${item.rank}`}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#25253a] transition-colors cursor-pointer"
            >
              <span
                className={`text-[11px] font-bold w-5 text-right flex-shrink-0 ${
                  item.rank === 1
                    ? "text-[#f59e0b]"
                    : item.rank === 2
                    ? "text-[#9ca3af]"
                    : item.rank === 3
                    ? "text-[#d97706]"
                    : "text-[#6b7280]"
                }`}
              >
                {item.rank}
              </span>
              <span className="text-[12px] text-white truncate">
                {item.title}
              </span>
            </div>
          ))}
        </div>
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
