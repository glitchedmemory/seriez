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
  displayName: string;
}

const genreColors: Record<string, [string, string]> = {
  Drama: ["#1e1b4b", "#312e81"], Action: ["#450a0a", "#991b1b"],
  Comedy: ["#422006", "#854d0e"], Thriller: ["#0f172a", "#1e293b"],
  Horror: ["#1a0000", "#330000"], "Sci-Fi": ["#1a0a2e", "#3b0764"],
  Romance: ["#4a0519", "#9d174d"], Mystery: ["#0a1628", "#172554"],
  Animation: ["#1a2e0a", "#3b6310"],
};

export default function YearlyRecapSlideshow({
  hours, titles, ratingAvg, ratedCount, topGenre, topGenreCount,
  allGenres, topActors, displayName,
}: YearlyRecapSlideshowProps) {
  const year = new Date().getFullYear();
  const [activeSlide, setActiveSlide] = useState(0);
  const [dotsMounted, setDotsMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalSlides = 6;
  const [gc1, gc2] = genreColors[topGenre] || ["#1e1b4b", "#3730a3"];

  useEffect(() => { setDotsMounted(true); }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveSlide(idx);
  };

  const handleShare = async () => {
    const text = `🎬 My ${year} on Seriez\n${hours}h · ${titles} titles · ★${ratingAvg || "—"}\nTop genre: ${topGenre}\n@${displayName}`;
    if (navigator.share) {
      try { await navigator.share({ title: `My ${year} Seriez Recap`, text }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); } catch {}
    }
  };

  return (
    <div className="mt-5">
      <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 px-4">
        {year} Recap
      </h3>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory -mx-4 px-4"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        {/* Slide 1 — Title */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center bg-black min-h-[360px]">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)" }} />
          <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-3 relative z-10">A Year in Watching</p>
          <h2 className="text-5xl font-black text-white leading-tight mb-2 relative z-10">{year}</h2>
          <p className="text-base text-white/50 italic mb-4 relative z-10">A Film by</p>
          <p className="text-2xl font-bold text-accent relative z-10">@{displayName}</p>
          <div className="absolute bottom-6 left-6 right-6">
            <div className="border-t border-white/10 pt-3 text-xs text-white/30 uppercase tracking-[0.2em]">
              Swipe →
            </div>
          </div>
        </div>

        {/* Slide 2 — Hours */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center min-h-[360px]" style={{ background: `linear-gradient(135deg, ${gc1}, ${gc2})` }}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-4">Total Watch Time</p>
            <span className="text-7xl font-black text-white tabular-nums">{hours}</span>
            <p className="text-2xl text-white/80 mt-1 font-light">HOURS</p>
            <p className="text-sm text-white/60 mt-4 max-w-[260px]">
              {hours >= 2000 ? "That's over 83 full days. More than many film school students." :
               hours >= 1000 ? "Over 40 days. A serious commitment to the screen." :
               hours >= 500 ? "20+ full days. Cinema is clearly your second home." :
               "Every hour well spent. Quality over quantity."}
            </p>
            <p className="text-sm text-white/50 mt-3">
              Across {titles} titles
            </p>
          </div>
        </div>

        {/* Slide 3 — Genres */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center min-h-[360px]" style={{ background: `linear-gradient(135deg, ${gc1}, ${gc2})` }}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 px-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Top Genre</p>
            <span className="text-4xl font-black text-white tracking-tight">{topGenre}</span>
            <p className="text-white/60 text-base mt-1">{topGenreCount} titles</p>
            {allGenres && allGenres[1] && (
              <div className="flex gap-2 justify-center mt-4">
                <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-xs">{allGenres[1].name} · {allGenres[1].count}</span>
                {allGenres[2] && <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-xs">{allGenres[2].name} · {allGenres[2].count}</span>}
              </div>
            )}
            <p className="text-white/50 text-sm italic mt-5 max-w-[240px]">
              {topGenre === "Drama" ? "You live for emotional depth and powerful performances." :
               topGenre === "Action" ? "Adrenaline is your preferred viewing fuel." :
               topGenre === "Comedy" ? "Laughter is the best medicine — and you know it." :
               topGenre === "Thriller" ? "You chase suspense like a seasoned detective." :
               topGenre === "Horror" ? "Fear is your comfort zone." :
               topGenre === "Sci-Fi" ? "The future fascinates you more than the present." :
               `"${topGenre}" defined your ${year}.`}
            </p>
          </div>
        </div>

        {/* Slide 4 — The Cast */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center min-h-[360px] bg-[#0a0a0a]">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.8) 100%)" }} />
          <div className="relative z-10 w-full px-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-5">Starring</p>
            <div className="space-y-3">
              {(topActors || []).slice(0, 5).map((a, i) => (
                <p key={a.name} className="text-white font-medium tracking-wide text-lg" style={{ opacity: 1 - i * 0.12 }}>
                  {a.name}
                </p>
              ))}
            </div>
            <p className="text-white/30 text-xs tracking-[0.15em] uppercase mt-6">and many more</p>
          </div>
          <div className="absolute bottom-4 right-4 text-white/10 text-xs uppercase tracking-[0.2em]">Top Actors</div>
        </div>

        {/* Slide 5 — The Awards */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center min-h-[360px]" style={{ background: "linear-gradient(135deg, #1a1400, #3d2e00)" }}>
          <div className="relative z-10">
            <span className="text-5xl mb-3 block">🏆</span>
            <p className="text-xs uppercase tracking-[0.2em] text-yellow-400/50 mb-2">Critical Consensus</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-black text-yellow-400">★</span>
              <span className="text-5xl font-black text-white">{ratingAvg || "—"}</span>
            </div>
            <p className="text-white/60 text-sm mt-2">{ratedCount} titles rated</p>
            <p className="text-yellow-400/60 text-sm italic mt-4 max-w-[240px]">
              {Number(ratingAvg) >= 4.0 ? "A true connoisseur with impeccable taste." :
               Number(ratingAvg) >= 3.5 ? "A balanced viewer who knows a good story when they see one." :
               Number(ratingAvg) >= 3.0 ? "Selective and honest — you don't hand out stars lightly." :
               "You save your highest praise for the truly deserving."}
            </p>
          </div>
        </div>

        {/* Slide 6 — Recap Summary + Share */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center min-h-[360px]" style={{ background: "linear-gradient(135deg, #0f0f1a, #1a0a2e, #3b0764)" }}>
          <div className="relative z-10 px-4 w-full">
            <p className="text-sm uppercase tracking-[0.2em] text-white/40 mb-2">{year}</p>
            <p className="text-4xl font-black text-white">{hours}h</p>
            <p className="text-sm text-white/50 mt-1">across {titles} titles</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-yellow-400 text-base">★{ratingAvg || "—"}</span>
              <span className="text-white/20">·</span>
              <span className="text-accent text-base">{topGenre}</span>
              <span className="text-white/20">·</span>
              <span className="text-white/40 text-sm">@{displayName}</span>
            </div>
            <div className="border-t border-white/10 mt-5 pt-5">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share My {year} Recap
              </button>
              <p className="text-white/25 text-xs mt-3">Discover more on Seriez</p>
            </div>
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
