"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PosterCalendar from "./PosterCalendar";
import DayPopup from "./DayPopup";
import type { DayEntry } from "./DayPopup";
import WatchGraph from "./WatchGraph";
import TopGenres from "./TopGenres";
import { StreamingTop10 } from "@/components/StreamingTop10";
import RouletteCard from "@/components/RouletteCard";
import type { WatchListItem } from "./WatchList";

interface HistoryData {
  calendar: Record<string, DayEntry[]>;
  stats: { weeklyHours: number; totalHours: number; allTimeHours: number; avgRating: number; totalTitles: number; totalEpisodes: number };
  monthlyGraph: { month: string; count: number }[];
  topGenres: { name: string; avgRating: number; count: number }[];
  watchList: WatchListItem[];
}

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function HistoryClient() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ date: string; entries: DayEntry[] } | null>(null);
  const prevDataRef = useRef<HistoryData | null>(null);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const fetchData = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setFetching(true);
    setError(null);
    try {
      const username = typeof window !== "undefined"
        ? (localStorage.getItem("seriez-username") || "glitchedmemory") : "glitchedmemory";
      const res = await fetch(`/api/history?username=${encodeURIComponent(username)}&month=${monthKey}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      prevDataRef.current = json;
      setData(json);
    } catch (err: any) {
      setError(err.message || "Error");
    }
    setLoading(false);
    setFetching(false);
  }, [monthKey]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  const goToPrevMonth = () => {
    setData(prevDataRef.current);
    setFetching(true);
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    setData(prevDataRef.current);
    setFetching(true);
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  if (loading && !data) {
    return (
      <div className="max-w-lg md:max-w-4xl mx-auto pb-32 px-4 pt-6">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-40 bg-bg-card rounded-lg" />
          <div className="aspect-square bg-bg-card rounded-2xl" />
          <div className="h-10 bg-bg-card rounded-xl" />
          <div className="h-44 bg-bg-card rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-lg md:max-w-4xl mx-auto pb-32 px-4 pt-20 text-center">
        <span className="text-4xl mb-4 block">📭</span>
        <h2 className="text-white text-lg font-bold mb-2">Error</h2>
        <p className="text-text-secondary text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  // ── Taste analysis ──
  const dayCounts: Record<number, number> = {};
  let bingeDays = 0;
  for (const [dk, entries] of Object.entries(data.calendar)) {
    const dow = new Date(dk + "T12:00:00").getDay();
    dayCounts[dow] = (dayCounts[dow] || 0) + 1;
    if (entries.reduce((s, e) => s + e.episodeCount, 0) >= 3) bingeDays++;
  }
  const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
  const activeDays = Object.keys(data.calendar).length;

  // Personality label
  const avgRating = data.stats.avgRating;
  let personaLabel: string;
  let personaDesc: string;
  if (avgRating >= 4.5) {
    personaLabel = "Generous Critic";
    personaDesc = "You hand out high ratings freely — you find joy in almost everything you watch.";
  } else if (avgRating >= 3.5) {
    personaLabel = "Immersive Viewer";
    personaDesc = "You dive deep into every title and don't hold back on high ratings. Quality picks with heart.";
  } else if (avgRating >= 2.5) {
    personaLabel = "Balanced Judge";
    personaDesc = "You keep it fair — not too harsh, not too easy. A true cinephile's balance.";
  } else {
    personaLabel = "Sharp Critic";
    personaDesc = "You watch with a critical eye and only the best earn your stars. Standards high, taste refined.";
  }

  return (
    <div className="max-w-lg md:max-w-4xl mx-auto pb-32">
      {/* ── Header nav ── */}
      <div className="pt-6 pb-2 px-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Monthly Recap</h1>
          <p className="text-text-secondary text-xs">Your viewing journal</p>
        </div>
        {fetching && (
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* ── Calendar ── */}
      <div className="px-4 mb-4">
        <PosterCalendar
          year={year} month={month} days={data.calendar}
          onDayClick={(d, e) => setPopup({ date: d, entries: e })}
          onPrevMonth={goToPrevMonth} onNextMonth={goToNextMonth}
          fetching={fetching}
        />
      </div>

      {/* ── Divider ── */}
      <div className="h-2 bg-[#0a0a14] mb-5" />

      {/* Watch time overview */}
      <div className="px-4 mb-5">
        <div className="grid grid-cols-3 gap-3">
          <StatCard value={`${data.stats.weeklyHours}h`} label="This Week" />
          <StatCard value={`${data.stats.totalHours}h`} label="This Month" />
          <StatCard value={`${data.stats.allTimeHours}h`} label="All Time" />
        </div>
      </div>

      {/* ── Taste Profile ── */}
      <div className="px-4 mb-5">
        <h2 className="text-lg font-extrabold text-white tracking-tight mb-3">Taste Profile</h2>
        <span className="inline-block bg-accent text-white text-[11px] font-bold px-3 py-1 rounded-full mb-2 tracking-wide">
          #RatingSpread
        </span>
        <p className="text-[15px] font-bold text-[#e5e7eb] tracking-tight mb-1">
          You&apos;re a &apos;{personaLabel}&apos;
        </p>
        <p className="text-[13px] text-text-secondary leading-relaxed mb-5">
          {personaDesc}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard value={data.stats.totalTitles.toString()} label="Titles" />
          <StatCard value={`${data.stats.totalHours}h`} label="Watch Time" />
          <StatCard value={data.stats.avgRating.toString()} label="Avg Rating" />
        </div>

        {/* Top Genres (moved from below) */}
        {data.watchList.length > 0 && (
          <TopGenres genres={data.topGenres} />
        )}

        {/* Streaming Top 10 */}
        <StreamingTop10 variant="page" />

        {/* 🎰 Roulette */}
        <div className="mt-8">
          <RouletteCard />
        </div>
      </div>

      {/* Popup */}
      {popup && <DayPopup date={popup.date} entries={popup.entries} onClose={() => setPopup(null)} />}
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-bg-card rounded-xl p-3.5 text-center">
      <p className="text-[22px] font-extrabold text-white tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-text-secondary mt-0.5">{label}</p>
    </div>
  );
}
