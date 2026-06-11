"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PosterCalendar from "./PosterCalendar";
import DayPopup from "./DayPopup";
import type { DayEntry } from "./DayPopup";
import WatchGraph from "./WatchGraph";
import TopGenres from "./TopGenres";
import type { WatchListItem } from "./WatchList";
import Link from "next/link";

interface MoodResult {
  id: number;
  title: string;
  poster: string | null;
  year: string;
  rating: number;
  type: "movie" | "tv";
  genres: string[];
  description: string;
  matchPercent: number;
  emoji: string;
}

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

  // Mood search state
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodResults, setMoodResults] = useState<MoodResult[]>([]);
  const [moodLoading, setMoodLoading] = useState(false);
  const [moodError, setMoodError] = useState<string | null>(null);

  const FREE_MOODS = ["intense", "easy"];
  const ALL_MOODS = ["intense", "easy", "mindbend", "light", "emotional"];

  const fetchMoodResults = useCallback(async (mood: string) => {
    setSelectedMood(mood);
    setMoodLoading(true);
    setMoodError(null);
    try {
      const res = await fetch(`/api/mood-search?mood=${encodeURIComponent(mood)}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMoodResults(json.results || []);
    } catch (err: any) {
      setMoodError(err.message || "Error");
      setMoodResults([]);
    }
    setMoodLoading(false);
  }, []);

  const handleMoodClick = (mood: string) => {
    if (FREE_MOODS.includes(mood)) {
      if (selectedMood === mood) {
        setSelectedMood(null);
        setMoodResults([]);
      } else {
        fetchMoodResults(mood);
      }
    } else {
      setSelectedMood(mood);
      setMoodResults([]);
    }
  };

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

      {/* ── Discover by Mood ── */}
      <div className="px-4 mb-5">
        <h2 className="text-lg font-extrabold text-white tracking-tight mb-3">Discover by Mood</h2>
        <p className="text-[11px] text-[#6b7280] mb-3">Find your next watch based on how you want to feel</p>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => handleMoodClick("intense")}
            className={`mood-chip flex flex-col items-center gap-1 rounded-2xl px-4 py-3 min-w-[68px] transition-all active:scale-95 border ${
              selectedMood === "intense" ? "bg-[#6366f1] border-[#6366f1]" : "bg-[#1a1a2e] border-[#2d2d4a]"
            }`}
          >
            <span className="text-2xl">⚡</span>
            <span className={`text-[10px] font-medium ${selectedMood === "intense" ? "text-white" : "text-[#9ca3af]"}`}>Intense</span>
          </button>
          <button
            onClick={() => handleMoodClick("easy")}
            className={`mood-chip flex flex-col items-center gap-1 rounded-2xl px-4 py-3 min-w-[68px] transition-all active:scale-95 border ${
              selectedMood === "easy" ? "bg-[#6366f1] border-[#6366f1]" : "bg-[#1a1a2e] border-[#2d2d4a]"
            }`}
          >
            <span className="text-2xl">😌</span>
            <span className={`text-[10px] font-medium ${selectedMood === "easy" ? "text-white" : "text-[#9ca3af]"}`}>Easy</span>
          </button>
          {["mindbend", "light", "emotional"].map((mood) => {
            const labels: Record<string, string> = { mindbend: "🧠 Mind-bend", light: "🍿 Light", emotional: "🎭 Emotional" };
            const isSelected = selectedMood === mood;
            return (
              <button
                key={mood}
                onClick={() => handleMoodClick(mood)}
                className={`mood-chip flex flex-col items-center gap-1 rounded-2xl px-4 py-3 min-w-[68px] transition-all active:scale-95 border relative ${
                  isSelected ? "bg-[#6366f1] border-[#6366f1]" : "bg-[#1a1a2e] border-[#2d2d4a]"
                }`}
              >
                <span className={`text-2xl ${isSelected ? "" : "opacity-40"}`}>{labels[mood].split(" ")[0]}</span>
                <span className={`text-[10px] font-medium ${isSelected ? "text-white" : "text-[#6b7280]"}`}>{labels[mood].split(" ").slice(1).join(" ")}</span>
              </button>
            );
          })}
        </div>

        {/* Mood Results */}
        {selectedMood && (
          <div className="mt-4">
            {moodLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 animate-pulse">
                    <div className="w-12 h-16 rounded bg-[#2d2d4a] flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-[#2d2d4a] rounded w-2/3" />
                      <div className="h-2 bg-[#2d2d4a] rounded w-full" />
                      <div className="h-2 bg-[#2d2d4a] rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!FREE_MOODS.includes(selectedMood) && !moodLoading && (
              <div className="bg-[#1e1b4b] border border-[#6366f1]/30 rounded-2xl p-6 text-center">
                <span className="text-3xl mb-3 block">{selectedMood === "mindbend" ? "🧠" : selectedMood === "light" ? "🍿" : "🎭"}</span>
                <h3 className="text-white font-bold text-base mb-1">Pro Feature</h3>
                <p className="text-[#9ca3af] text-sm mb-4">Unlock all moods with Seriez Pro. Discover more of what you love.</p>
                <button className="px-6 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-semibold rounded-xl transition-colors">
                  Upgrade to Pro
                </button>
              </div>
            )}

            {moodError && (
              <div className="text-center py-6">
                <span className="text-2xl mb-2 block">😕</span>
                <p className="text-[#9ca3af] text-sm">Couldn&apos;t load recommendations. Try again later.</p>
              </div>
            )}

            {!moodLoading && !moodError && moodResults.length > 0 && (
              <div>
                {/* Hero pick */}
                <Link
                  href={`/title/${moodResults[0].id}?type=${moodResults[0].type}`}
                  className="block bg-[#1a1a2e] border border-[#2d2d4a] hover:border-[#6366f1]/50 rounded-2xl overflow-hidden transition-colors mb-3"
                >
                  <div className="h-32 bg-gradient-to-br from-[#1e1a3e] via-[#2a1f4f] to-[#1a1a2e] flex items-center justify-center relative">
                    {moodResults[0].poster ? (
                      <img src={moodResults[0].poster} alt="" className="w-full h-full object-cover absolute inset-0 opacity-60" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-transparent to-transparent" />
                    <span className="text-4xl relative z-10">{moodResults[0].emoji}</span>
                    <span className="absolute top-3 left-3 bg-[#6366f1] text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">#1 PICK</span>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[#f59e0b] text-xs">★ {moodResults[0].rating}</span>
                      <span className="text-[#9ca3af] text-xs">{moodResults[0].year} · {moodResults[0].type === "movie" ? "Movie" : "TV"}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{moodResults[0].title}</h3>
                    <p className="text-[11px] text-[#9ca3af] mt-1 leading-relaxed line-clamp-2">{moodResults[0].description}</p>
                    <span className="text-[10px] text-[#818cf8] mt-1.5 inline-block">{moodResults[0].emoji} {moodResults[0].matchPercent}% match</span>
                  </div>
                </Link>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {moodResults.slice(1, 5).map((item) => (
                    <Link
                      key={item.id}
                      href={`/title/${item.id}?type=${item.type}`}
                      className="block bg-[#1a1a2e] border border-[#2d2d4a] hover:border-[#6366f1]/40 rounded-xl overflow-hidden transition-colors"
                    >
                      <div className="h-28 bg-gradient-to-br from-[#25253a] to-[#1a1a2e] flex items-center justify-center relative">
                        {item.poster ? (
                          <img src={item.poster} alt="" className="w-full h-full object-cover absolute inset-0 opacity-40" />
                        ) : null}
                        <span className="text-2xl relative z-10">{item.emoji}</span>
                      </div>
                      <div className="p-2.5">
                        <span className="text-[#f59e0b] text-[10px]">★ {item.rating}</span>
                        <h4 className="text-xs font-semibold text-white mt-0.5 truncate">{item.title}</h4>
                        <p className="text-[10px] text-[#9ca3af] mt-1 line-clamp-2 leading-relaxed">{item.description.slice(0, 60)}...</p>
                        <span className="text-[10px] text-[#818cf8] mt-1 inline-block">{item.matchPercent}% match</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
