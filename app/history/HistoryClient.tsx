"use client";

import { useState, useEffect, useCallback } from "react";
import PosterCalendar from "./PosterCalendar";
import DayPopup from "./DayPopup";
import type { DayEntry } from "./DayPopup";
import WatchGraph from "./WatchGraph";
import TopGenres from "./TopGenres";
import WatchList from "./WatchList";
import type { WatchListItem } from "./WatchList";

interface HistoryData {
  calendar: Record<string, DayEntry[]>;
  stats: {
    totalHours: number;
    avgRating: number;
    totalTitles: number;
    totalEpisodes: number;
  };
  monthlyGraph: { month: string; count: number }[];
  topGenres: { name: string; avgRating: number; count: number }[];
  watchList: WatchListItem[];
}

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export default function HistoryClient() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<{
    date: string;
    entries: DayEntry[];
  } | null>(null);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const username =
        typeof window !== "undefined"
          ? (localStorage.getItem("seriez-username") || "glitchedmemory")
          : "glitchedmemory";
      const res = await fetch(
        `/api/history?username=${encodeURIComponent(username)}&month=${monthKey}`
      );
      if (!res.ok) throw new Error("Failed to load history");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  }, [monthKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDayClick = (date: string, entries: DayEntry[]) => {
    setPopup({ date, entries });
  };

  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto pb-32 px-4 pt-6">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-[#1a1a2e] rounded-lg" />
          <div className="aspect-square bg-[#1a1a2e] rounded-2xl" />
          <div className="h-12 bg-[#1a1a2e] rounded-xl" />
          <div className="h-48 bg-[#1a1a2e] rounded-2xl" />
          <div className="h-32 bg-[#1a1a2e] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto pb-32 px-4 pt-20">
        <div className="flex flex-col items-center text-center">
          <span className="text-4xl mb-4">📭</span>
          <h2 className="text-white text-lg font-bold mb-2">Something went wrong</h2>
          <p className="text-[#6b7280] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ─── Taste Analysis ───
  const dayCounts: Record<number, number> = {};
  let bingeDays = 0; // 3+ episodes in a day
  for (const [dateKey, entries] of Object.entries(data.calendar)) {
    const d = new Date(dateKey + "T12:00:00");
    const dow = d.getDay();
    dayCounts[dow] = (dayCounts[dow] || 0) + 1;
    const totalEps = entries.reduce((sum, e) => sum + e.episodeCount, 0);
    if (totalEps >= 3) bingeDays++;
  }
  const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
  const mostActiveDow = sortedDays[0];
  const activeDays = Object.keys(data.calendar).length;

  // Media breakdown from watchList
  const mediaCounts: Record<string, number> = {};
  for (const item of data.watchList) {
    mediaCounts[item.mediaType] = (mediaCounts[item.mediaType] || 0) + 1;
  }

  // Determine viewing style
  const viewingStyle =
    bingeDays >= activeDays * 0.4
      ? "Binge Watcher — you love marathons!"
      : activeDays > 0 && data.stats.totalEpisodes / activeDays >= 2
      ? "Steady Viewer — consistent daily watching"
      : "Casual Viewer — you watch at your own pace";

  // Avg per active day
  const avgPerDay =
    activeDays > 0
      ? (data.stats.totalEpisodes / activeDays).toFixed(1)
      : "0";

  return (
    <div className="max-w-lg mx-auto pb-32">
      <div className="px-4 pt-6 mb-4">
        <h1 className="text-2xl font-bold text-white">Watch History</h1>
        <p className="text-[#6b7280] text-sm mt-1">Your viewing diary</p>
      </div>

      <div className="px-4 space-y-5">
        {/* ─── Poster Calendar ─── */}
        <PosterCalendar
          year={year}
          month={month}
          days={data.calendar}
          onDayClick={handleDayClick}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
        />

        {/* ─── Quick Stats ─── */}
        <div className="flex flex-wrap gap-2">
          <StatPill icon="⏱" value={`${data.stats.totalHours}h`} label="watched" />
          <StatPill icon="★" value={data.stats.avgRating.toString()} label="avg rating" />
          <StatPill icon="🎬" value={data.stats.totalTitles.toString()} label="titles" />
          <StatPill icon="📺" value={data.stats.totalEpisodes.toString()} label="episodes" />
        </div>

        {/* ─── Taste Analysis ─── */}
        <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
          <h2 className="text-white text-base font-bold mb-1">
            🧬 Taste Analysis
          </h2>
          <p className="text-[#6b7280] text-xs mb-4">
            Insights from your viewing habits
          </p>

          <div className="space-y-3">
            {/* Viewing style */}
            <div className="bg-[#0f0f1a] rounded-xl p-3">
              <p className="text-[#818cf8] text-sm font-semibold">{viewingStyle}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <TasteCard
                label="Most Active Day"
                value={mostActiveDow ? DAY_NAMES[parseInt(mostActiveDow[0])] : "—"}
              />
              <TasteCard
                label="Episodes / Day"
                value={avgPerDay}
              />
              <TasteCard
                label="Binge Days"
                value={`${bingeDays} day${bingeDays !== 1 ? "s" : ""}`}
                sub={`${activeDays} active day${activeDays !== 1 ? "s" : ""}`}
              />
              <TasteCard
                label="Media Mix"
                value={[
                  mediaCounts.movie ? `🎬${mediaCounts.movie}` : "",
                  mediaCounts.tv ? `📺${mediaCounts.tv}` : "",
                  mediaCounts.anime ? `🎌${mediaCounts.anime}` : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            </div>

            {/* Review quality */}
            {data.stats.avgRating > 0 && (
              <div className="bg-[#0f0f1a] rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">
                  {data.stats.avgRating >= 4.0 ? "🌟" : data.stats.avgRating >= 3.0 ? "👍" : "🤔"}
                </span>
                <div>
                  <p className="text-white text-sm font-medium">
                    {data.stats.avgRating >= 4.0
                      ? "You're a generous reviewer!"
                      : data.stats.avgRating >= 3.0
                      ? "You have balanced taste"
                      : "You're selective with your ratings"}
                  </p>
                  <p className="text-[#6b7280] text-xs">
                    Average rating: ★ {data.stats.avgRating} across {data.stats.totalTitles} titles
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Monthly Graph ─── */}
        <WatchGraph data={data.monthlyGraph} />

        {/* ─── Top Genres ─── */}
        <TopGenres genres={data.topGenres} />

        {/* ─── Watch List ─── */}
        <WatchList items={data.watchList} />
      </div>

      {popup && (
        <DayPopup
          date={popup.date}
          entries={popup.entries}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

function StatPill({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-[#1a1a2e] border border-[#2d2d4a] rounded-full px-3 py-1.5">
      <span className="text-xs">{icon}</span>
      <span className="text-white text-xs font-semibold">{value}</span>
      <span className="text-[#6b7280] text-[10px]">{label}</span>
    </div>
  );
}

function TasteCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#0f0f1a] rounded-xl p-3">
      <p className="text-[#6b7280] text-[10px] uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-white text-sm font-bold">{value || "—"}</p>
      {sub && <p className="text-[#6b7280] text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}
