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
    setData(prevDataRef.current); // keep old data visible
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
      <div className="max-w-lg mx-auto pb-32 px-4 pt-6">
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
      <div className="max-w-lg mx-auto pb-32 px-4 pt-20 text-center">
        <span className="text-4xl mb-4 block">📭</span>
        <h2 className="text-white text-lg font-bold mb-2">Error</h2>
        <p className="text-[#6b7280] text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  // Taste analysis
  const dayCounts: Record<number, number> = {};
  let bingeDays = 0;
  for (const [dk, entries] of Object.entries(data.calendar)) {
    const dow = new Date(dk + "T12:00:00").getDay();
    dayCounts[dow] = (dayCounts[dow] || 0) + 1;
    if (entries.reduce((s, e) => s + e.episodeCount, 0) >= 3) bingeDays++;
  }
  const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
  const activeDays = Object.keys(data.calendar).length;

  const mediaCounts: Record<string, number> = {};
  for (const item of data.watchList) mediaCounts[item.mediaType] = (mediaCounts[item.mediaType] || 0) + 1;

  const viewingStyle = bingeDays >= activeDays * 0.4
    ? "Binge Watcher — you love marathons!"
    : activeDays > 0 && data.stats.totalEpisodes / activeDays >= 2
    ? "Steady Viewer — consistent daily watching"
    : "Casual Viewer — watching at your own pace";

  return (
    <div className="max-w-lg mx-auto pb-32">
      <div className="px-4 pt-6 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Watch History</h1>
          <p className="text-[#6b7280] text-sm">Your viewing diary</p>
        </div>
        {fetching && (
          <div className="w-5 h-5 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      <div className="px-4 space-y-5">
        {/* Poster Calendar */}
        <PosterCalendar
          year={year} month={month} days={data.calendar}
          onDayClick={(d, e) => setPopup({ date: d, entries: e })}
          onPrevMonth={goToPrevMonth} onNextMonth={goToNextMonth}
          fetching={fetching}
        />

        {/* Quick Stats — pill style */}
        <div className="flex gap-3">
          <MiniStat value={`${data.stats.totalHours}h`} label="Watched" />
          <MiniStat value={`★ ${data.stats.avgRating}`} label="Rating" />
          <MiniStat value={data.stats.totalTitles.toString()} label="Titles" />
          <MiniStat value={data.stats.totalEpisodes.toString()} label="Episodes" />
        </div>

        {/* Taste Analysis */}
        <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
          <h2 className="text-white text-base font-bold mb-4">🧬 Taste Analysis</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <TasteCard label="Viewing Style" value={viewingStyle} full />
            <TasteCard
              label="Most Active"
              value={sortedDays[0] ? DAYS[parseInt(sortedDays[0][0])] : "—"}
            />
            <TasteCard label="Episodes / Day" value={activeDays > 0 ? (data.stats.totalEpisodes / activeDays).toFixed(1) : "0"} />
            <TasteCard label="Binge Days" value={`${bingeDays} of ${activeDays}`} />
          </div>
          <div className="flex gap-2 text-xs">
            {mediaCounts.movie ? <span className="bg-[#0f0f1a] text-white px-2 py-1 rounded-full">🎬 {mediaCounts.movie} Movies</span> : null}
            {mediaCounts.tv ? <span className="bg-[#0f0f1a] text-white px-2 py-1 rounded-full">📺 {mediaCounts.tv} TV</span> : null}
            {mediaCounts.anime ? <span className="bg-[#0f0f1a] text-white px-2 py-1 rounded-full">🎌 {mediaCounts.anime} Anime</span> : null}
          </div>
        </div>

        {/* Monthly Graph */}
        <WatchGraph data={data.monthlyGraph} />

        {/* Top Genres */}
        <TopGenres genres={data.topGenres} />

        {/* Watch List */}
        <WatchList items={data.watchList} />
      </div>

      {popup && <DayPopup date={popup.date} entries={popup.entries} onClose={() => setPopup(null)} />}
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 text-center">
      <p className="text-white text-sm font-bold">{value}</p>
      <p className="text-[#6b7280] text-[10px] uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function TasteCard({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`bg-[#0f0f1a] rounded-xl p-3 ${full ? "col-span-2" : ""}`}>
      <p className="text-[#6b7280] text-[10px] uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-white font-semibold ${full ? "text-sm" : "text-sm"}`}>{value}</p>
    </div>
  );
}
