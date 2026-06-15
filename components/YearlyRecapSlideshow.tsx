"use client";

import { useState, useEffect, useRef } from "react";

interface YearlyRecapSlideshowProps {
  hours: number;
  titles: number;
  ratingAvg: number | string;
  ratedCount: number;
  topGenre: string;
  topGenreCount: number;
  allGenres: { name: string; count: number }[];
  topActors: { name: string; count: number }[];
  topDirectors: { name: string; count: number }[];
  monthlyWatch: { month: string; count: number }[];
  ratingDistribution: { score: number; count: number }[];
  completionRate: number;
  completionStarted: number;
  completionCompleted: number;
  displayName: string;
}

export default function YearlyRecapSlideshow({
  hours, titles, ratingAvg, ratedCount, topGenre, topGenreCount,
  allGenres, topActors, topDirectors, monthlyWatch, ratingDistribution,
  completionRate, completionStarted, completionCompleted, displayName,
}: YearlyRecapSlideshowProps) {
  const year = new Date().getFullYear();
  const [activeSlide, setActiveSlide] = useState(0);
  const [dotsMounted, setDotsMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalSlides = 6;

  useEffect(() => { setDotsMounted(true); }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveSlide(idx);
  };

  const handleShare = async () => {
    const profileUrl = `https://seriez.app/profile?username=${encodeURIComponent(displayName)}`;
    const text = `🎬 My ${year} on Seriez\n${hours}h · ${titles} titles · ★${ratingAvg || "—"}\nTop genre: ${topGenre}\n\n${profileUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: `My ${year} Seriez Recap`, text, url: profileUrl }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); alert("Profile link copied to clipboard!"); } catch {}
    }
  };

  const maxGenreCount = allGenres[0]?.count || 1;
  const maxRatingCount = Math.max(...(ratingDistribution || []).map(d => d.count), 1);
  const maxMonthly = Math.max(...(monthlyWatch || []).map(m => m.count), 1);
  const peakMonth = monthlyWatch?.reduce((a, b) => a.count > b.count ? a : b, monthlyWatch[0]);
  const daysWatched = Math.round(hours / 24);

  return (
    <div className="mt-5">
      <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 px-4">
        {year} Wrapped
      </h3>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory -mx-4 px-4"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        {/* ── Slide 1 — Overview ── */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl bg-bg-card border border-border p-6 flex flex-col min-h-[340px]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-1">Your Year in Numbers</p>
          <p className="text-4xl font-black text-text-primary mb-5">{year}</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-bg-primary rounded-xl p-3.5">
              <p className="text-2xl font-bold text-text-primary tabular-nums">{hours}</p>
              <p className="text-[10px] text-text-secondary uppercase tracking-wide">Hours · {daysWatched}d</p>
            </div>
            <div className="bg-bg-primary rounded-xl p-3.5">
              <p className="text-2xl font-bold text-text-primary tabular-nums">{titles}</p>
              <p className="text-[10px] text-text-secondary uppercase tracking-wide">Titles</p>
            </div>
            <div className="bg-bg-primary rounded-xl p-3.5">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-yellow-400 tabular-nums">{ratingAvg || "—"}</span>
                <span className="text-yellow-400 text-xs">★</span>
              </div>
              <p className="text-[10px] text-text-secondary uppercase tracking-wide">Avg Rating</p>
            </div>
            <div className="bg-bg-primary rounded-xl p-3.5">
              <p className="text-2xl font-bold text-text-primary tabular-nums">{ratedCount}</p>
              <p className="text-[10px] text-text-secondary uppercase tracking-wide">Rated</p>
            </div>
          </div>

          {completionStarted > 0 && (
            <div className="mt-auto">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-text-secondary uppercase tracking-wide">Completion</span>
                <span className="text-text-primary font-medium">{completionRate}%</span>
              </div>
              <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent to-[#a855f7] rounded-full transition-all duration-700"
                     style={{ width: `${completionRate}%` }} />
              </div>
              <p className="text-[9px] text-text-secondary mt-1">{completionCompleted}/{completionStarted} series finished</p>
            </div>
          )}
        </div>

        {/* ── Slide 2 — Genres ── */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl bg-bg-card border border-border p-6 flex flex-col min-h-[340px]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-4">Top Genres</p>
          <div className="space-y-3 flex-1">
            {allGenres.slice(0, 6).map((g, i) => {
              const pct = Math.round((g.count / maxGenreCount) * 100);
              return (
                <div key={g.name}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm text-text-primary font-medium">{g.name}</span>
                    <span className="text-[10px] text-text-secondary tabular-nums">{g.count}</span>
                  </div>
                  <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(pct, 8)}%`,
                        background: i === 0
                          ? "linear-gradient(90deg, #6366f1, #a855f7)"
                          : `rgba(99, 102, 241, ${0.7 - i * 0.12})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Slide 3 — Rating Distribution ── */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl bg-bg-card border border-border p-6 flex flex-col min-h-[340px]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-4">Rating Distribution</p>
          <div className="space-y-2 flex-1">
            {(ratingDistribution || []).map((d) => {
              const pct = Math.round((d.count / maxRatingCount) * 100);
              const isMax = d.count === maxRatingCount;
              return (
                <div key={d.score} className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary w-8 text-right tabular-nums">
                    {d.score}★
                  </span>
                  <div className="flex-1 h-4 bg-bg-primary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2 ${
                        isMax ? "bg-yellow-400/80" : "bg-accent/40"
                      }`}
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    >
                      {d.count > 0 && (
                        <span className="text-[9px] font-bold text-white tabular-nums">{d.count}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-text-secondary mt-3 text-center">
            Most given: ★{ratingDistribution?.reduce((a, b) => a.count > b.count ? a : b, ratingDistribution[0])?.score || "—"}
          </p>
        </div>

        {/* ── Slide 4 — People ── */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl bg-bg-card border border-border p-6 flex flex-col min-h-[340px]">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-3">Most Watched Actors</p>
            <div className="space-y-2 mb-5">
              {topActors.slice(0, 4).map((a, i) => (
                <div key={a.name} className="flex items-center justify-between">
                  <span className="text-sm text-text-primary">{a.name}</span>
                  <span className="text-[10px] text-text-secondary tabular-nums">{a.count} titles</span>
                </div>
              ))}
              {topActors.length === 0 && (
                <p className="text-xs text-text-secondary">No data yet</p>
              )}
            </div>

            {topDirectors.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-3">Most Watched Directors</p>
                <div className="space-y-2">
                  {topDirectors.slice(0, 4).map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <span className="text-sm text-text-primary">{d.name}</span>
                      <span className="text-[10px] text-text-secondary tabular-nums">{d.count} titles</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Slide 5 — Monthly Activity ── */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl bg-bg-card border border-border p-6 flex flex-col min-h-[340px]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-4">Monthly Activity</p>
          <div className="flex-1">
            <div className="grid grid-cols-6 gap-2">
              {(monthlyWatch || []).map((m) => {
                const intensity = m.count / maxMonthly;
                return (
                  <div key={m.month} className="text-center">
                    <div
                      className="w-full aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
                      style={{
                        backgroundColor: m.count === 0
                          ? "rgb(26, 26, 46)"
                          : `rgba(99, 102, 241, ${Math.max(intensity, 0.1).toFixed(2)})`,
                        color: intensity > 0.6 ? "#fff" : undefined,
                      }}
                    >
                      {m.count || ""}
                    </div>
                    <span className="text-[9px] text-text-secondary mt-1 block">
                      {m.month.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>

            {peakMonth && peakMonth.count > 0 && (
              <div className="mt-4 text-center">
                <p className="text-[10px] text-text-secondary uppercase tracking-wide">
                  Peak Month
                </p>
                <p className="text-lg font-bold text-accent">
                  {new Date(peakMonth.month + "-01").toLocaleString("en-US", { month: "long" })}
                </p>
                <p className="text-xs text-text-secondary">{peakMonth.count} titles</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Slide 6 — Summary + Share ── */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl bg-gradient-to-br from-bg-card to-[#1a1025] border border-[#2d1f3d] p-6 flex flex-col items-center justify-center text-center min-h-[340px]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-2">{year} Wrapped</p>
          <p className="text-3xl font-bold text-text-primary">@{displayName}</p>

          <div className="flex items-center justify-center gap-3 my-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-text-primary tabular-nums">{hours}h</p>
              <p className="text-[9px] text-text-secondary">watched</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400 tabular-nums">{ratingAvg || "—"}</p>
              <p className="text-[9px] text-text-secondary">avg ★</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-accent tabular-nums">{topGenre}</p>
              <p className="text-[9px] text-text-secondary">top genre</p>
            </div>
          </div>

          <p className="text-xs text-text-secondary mb-6">
            {titles} titles · {ratedCount} rated · {completionRate}% completion
          </p>

          <div className="w-full max-w-[240px] space-y-2">
            <button
              onClick={handleShare}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-[#818cf8] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share My Recap
            </button>
          </div>
        </div>
      </div>

      {/* Dots */}
      {dotsMounted && (
      <div className="flex justify-center gap-1.5 mt-3">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            onClick={() => { scrollRef.current?.scrollTo({ left: scrollRef.current.clientWidth * i, behavior: "smooth" }); }}
            className={`w-2 h-2 rounded-full transition-all ${i === activeSlide ? "bg-accent w-4" : "bg-border hover:bg-text-secondary"}`}
          />
        ))}
      </div>
      )}
    </div>
  );
}
