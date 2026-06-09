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

  // Loading skeleton
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

  // Error
  if (error) {
    return (
      <div className="max-w-lg mx-auto pb-32 px-4 pt-20">
        <div className="flex flex-col items-center text-center">
          <span className="text-4xl mb-4">📭</span>
          <h2 className="text-white text-lg font-bold mb-2">
            {error.includes("log in") ? "Log in required" : "Something went wrong"}
          </h2>
          <p className="text-[#6b7280] text-sm">
            {error.includes("log in")
              ? "Sign in to see your watch history."
              : error}
          </p>
          {error.includes("log in") && (
            <a
              href="/login"
              className="mt-4 px-6 py-2 bg-[#6366f1] text-white text-sm font-semibold rounded-xl hover:bg-[#818cf8] transition-colors"
            >
              Sign In
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Compute most active day of week
  const dayCounts: Record<number, number> = {};
  for (const dateKey of Object.keys(data.calendar)) {
    const d = new Date(dateKey + "T12:00:00");
    const dow = d.getDay();
    dayCounts[dow] = (dayCounts[dow] || 0) + 1;
  }
  const mostActiveDow = Object.entries(dayCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const DAY_NAMES = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
    "Saturday",
  ];

  return (
    <div className="max-w-lg mx-auto pb-32">
      {/* Page header */}
      <div className="px-4 pt-6 mb-4">
        <h1 className="text-2xl font-bold text-white">Watch History</h1>
        <p className="text-[#6b7280] text-sm mt-1">
          Your viewing diary for {monthKey}
        </p>
      </div>

      <div className="px-4 space-y-5">
        {/* ─── Section 1: Poster Calendar ─── */}
        <PosterCalendar
          year={year}
          month={month}
          days={data.calendar}
          onDayClick={handleDayClick}
        />

        {/* ─── Quick Stats ─── */}
        <div className="flex flex-wrap gap-2">
          <StatPill
            icon="⏱"
            value={`${data.stats.totalHours}h`}
            label="watched"
          />
          <StatPill
            icon="★"
            value={data.stats.avgRating.toString()}
            label="avg rating"
          />
          <StatPill
            icon="🎬"
            value={data.stats.totalTitles.toString()}
            label="titles"
          />
          <StatPill
            icon="📺"
            value={data.stats.totalEpisodes.toString()}
            label="episodes"
          />
        </div>

        {/* ─── Section 2: Monthly Graph ─── */}
        <WatchGraph data={data.monthlyGraph} />
        {mostActiveDow && (
          <p className="text-[#6b7280] text-xs -mt-3 text-center">
            Most active: {DAY_NAMES[parseInt(mostActiveDow[0])]}
          </p>
        )}

        {/* ─── Section 3: Top Genres ─── */}
        <TopGenres genres={data.topGenres} />

        {/* ─── Section 4: Watch List ─── */}
        <WatchList items={data.watchList} />
      </div>

      {/* Day detail popup */}
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
