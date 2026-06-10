"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PosterCalendar from "./PosterCalendar";
import DayPopup from "./DayPopup";
import type { DayEntry } from "./DayPopup";
import WatchGraph from "./WatchGraph";
import TopGenres from "./TopGenres";
import WatchList from "./WatchList";
import type { WatchListItem } from "./WatchList";

interface HistoryData {
  calendar: Record<string, DayEntry[]>;
  stats: { totalHours: number; avgRating: number; totalTitles: number; totalEpisodes: number };
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
          <div className="h-8 w-40 bg-[#1a1a2e] rounded-lg" />
          <div className="aspect-square bg-[#1a1a2e] rounded-2xl" />
          <div className="h-10 bg-[#1a1a2e] rounded-xl" />
          <div className="h-44 bg-[#1a1a2e] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-lg md:max-w-4xl mx-auto pb-32 px-4 pt-20 text-center">
        <span className="text-4xl mb-4 block">📭</span>
        <h2 className="text-white text-lg font-bold mb-2">Error</h2>
        <p className="text-[#6b7280] text-sm">{error}</p>
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

  // Rating distribution
  const ratingDist: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0.5 ~ 5.0
  for (const item of data.watchList) {
    if (item.rating > 0) {
      const idx = Math.round(item.rating * 2) - 1;
      if (idx >= 0 && idx < 11) ratingDist[idx]++;
    }
  }
  const starBuckets = [
    { label: "5★", count: ratingDist[9] + ratingDist[10] || 0 },
    { label: "4★", count: ratingDist[7] + ratingDist[8] || 0 },
    { label: "3★", count: ratingDist[5] + ratingDist[6] || 0 },
    { label: "2★", count: ratingDist[3] + ratingDist[4] || 0 },
    { label: "1★", count: ratingDist[1] + ratingDist[2] || 0 },
  ];
  const maxStarCount = Math.max(...starBuckets.map(b => b.count), 1);

  return (
    <div className="max-w-lg md:max-w-4xl mx-auto pb-32">
      {/* ── Header nav ── */}
      <div className="pt-6 pb-2 px-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Monthly Recap</h1>
          <p className="text-[#6b7280] text-xs">Your viewing journal</p>
        </div>
        {fetching && (
          <div className="w-5 h-5 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
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

      {/* ── Taste Profile ── */}
      <div className="px-4 mb-5">
        <h2 className="text-lg font-extrabold text-white tracking-tight mb-3">Taste Profile</h2>
        <span className="inline-block bg-[#6366f1] text-white text-[11px] font-bold px-3 py-1 rounded-full mb-2 tracking-wide">
          #RatingSpread
        </span>
        <p className="text-[15px] font-bold text-[#e5e7eb] tracking-tight mb-1">
          You&apos;re a &apos;{personaLabel}&apos;
        </p>
        <p className="text-[13px] text-[#9ca3af] leading-relaxed mb-5">
          {personaDesc}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard value={data.stats.totalTitles.toString()} label="Titles" />
          <StatCard value={`${data.stats.totalHours}h`} label="Watch Time" />
          <StatCard value={data.stats.avgRating.toString()} label="Avg Rating" />
        </div>

        {/* Rating Spread */}
        {data.watchList.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[15px] font-bold text-white tracking-tight mb-3">Rating Spread</h3>
            <div className="space-y-1.5">
              {starBuckets.map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className="w-7 text-right text-xs font-semibold text-[#d1d5db]">{b.label}</span>
                  <div className="flex-1 h-2.5 bg-[#25253a] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${b.label === "5★" || b.label === "4★" ? "bg-[#6366f1]" : "bg-[#4338ca]"}`}
                      style={{ width: `${(b.count / maxStarCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-4 text-right text-[11px] font-semibold text-[#9ca3af]">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Genres */}
        <TopGenres genres={data.topGenres} />
      </div>

      {/* ── Divider ── */}
      <div className="h-2 bg-[#0a0a14] mb-5" />

      {/* ── This Month's Diary ── */}
      <WatchList items={data.watchList} monthlyView />

      {popup && <DayPopup date={popup.date} entries={popup.entries} onClose={() => setPopup(null)} />}
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-3.5 text-center">
      <p className="text-[22px] font-extrabold text-white tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-[#9ca3af] mt-0.5">{label}</p>
    </div>
  );
}
