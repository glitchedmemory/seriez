"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PosterCalendar from "./PosterCalendar";
import DayPopup from "./DayPopup";
import type { DayEntry } from "./DayPopup";
import WatchGraph from "./WatchGraph";
import RouletteCard from "@/components/RouletteCard";
import type { WatchListItem } from "./WatchList";

interface HistoryData {
  calendar: Record<string, DayEntry[]>;
  stats: { weeklyHours: number; totalHours: number; allTimeHours: number; avgRating: number; totalTitles: number; totalEpisodes: number };
  monthlyGraph: { month: string; count: number }[];
  topGenres: { name: string; avgRating: number; count: number }[];
  watchList: WatchListItem[];
  persona: { label: string; desc: string; tier: number } | null;
  isPremium: boolean;
}

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function HistoryClient({ profileUsername, isOwn }: { profileUsername: string; isOwn?: boolean }) {
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
      const res = await fetch(`/api/history?username=${encodeURIComponent(profileUsername)}&month=${monthKey}`);
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
      <div className="pb-32 px-4 pt-6">
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
      <div className="pb-32 px-4 pt-20 text-center">
        <span className="text-4xl mb-4 block">📭</span>
        <h2 className="text-text-primary text-lg font-bold mb-2">Error</h2>
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

  // Persona from API (AI-analyzed watch patterns)
  const persona = data.persona;

  return (
    <div className="pb-32">
      {/* ── Header nav ── */}
      <div className="pt-6 pb-2 px-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary tracking-tight">Monthly Recap</h1>
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
      <div className="h-2 bg-border light:bg-text-secondary/15 mb-5" />

      {/* 🎰 Roulette — only on own profile */}
      {isOwn && (
      <div className="mt-8">
        <RouletteCard />
      </div>
      )}

      {/* Popup */}
      {popup && <DayPopup date={popup.date} entries={popup.entries} onClose={() => setPopup(null)} />}
    </div>
  );
}
