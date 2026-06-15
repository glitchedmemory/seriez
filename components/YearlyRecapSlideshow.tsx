"use client";

import { useState, useEffect, useRef } from "react";

interface LibraryItem {
  tmdb_id: number;
  media_type: string;
  title: string;
  poster: string | null;
  rating: number | null;
  year: number | null;
}

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
  mediaBreakdown: { movie: number; tv: number; anime: number };
  mediaHours: { movie: number; tv: number; anime: number };
  library: LibraryItem[];
  reviewsMap: Record<string, string>; // key: `${tmdb_id}-${media_type}`, value: first line of review
}

const GENRE_STYLES: Record<string, { label: string; emoji: string; color: string; desc: string }> = {
  Action: { label: "Action Junkie", emoji: "💥", color: "#ef4444", desc: "Adrenaline is your love language. Explosions, chases, and heroes who never quit." },
  Drama: { label: "Drama Connoisseur", emoji: "🎭", color: "#8b5cf6", desc: "You live for emotional depth and powerful performances. Stories that make you feel." },
  Comedy: { label: "Comedy Buff", emoji: "😂", color: "#f59e0b", desc: "Laughter is your medicine. You know timing is everything — in jokes and in life." },
  Thriller: { label: "Thrill Seeker", emoji: "🔪", color: "#6b7280", desc: "You chase suspense like a detective on a cold trail. Edge-of-your-seat is your comfort zone." },
  Horror: { label: "Fearless Watcher", emoji: "👻", color: "#dc2626", desc: "Fear doesn't scare you — it excites you. The darker the night, the brighter your screen." },
  "Sci-Fi": { label: "Future Explorer", emoji: "🚀", color: "#06b6d4", desc: "The future fascinates you more than the present. You're always one warp jump ahead." },
  Romance: { label: "Hopeless Romantic", emoji: "💕", color: "#ec4899", desc: "You believe in love stories — the messier, the better. Your heart wears no armor." },
  Mystery: { label: "Puzzle Solver", emoji: "🔍", color: "#4b5563", desc: "Every frame is a clue. You're not just watching — you're investigating." },
  Animation: { label: "Animation Devotee", emoji: "✨", color: "#10b981", desc: "You know great storytelling transcends medium. Drawn worlds, real emotions." },
  Documentary: { label: "Truth Seeker", emoji: "📚", color: "#6366f1", desc: "Reality is stranger than fiction, and you're here for every frame of it." },
  Adventure: { label: "Born Explorer", emoji: "🗺️", color: "#f97316", desc: "Every film is a journey. You go where the story takes you, no map required." },
  Fantasy: { label: "Dream Weaver", emoji: "🐉", color: "#a855f7", desc: "You don't escape reality — you expand it. Magic is just another word for possibility." },
  Crime: { label: "Case Cracker", emoji: "🕵️", color: "#1e293b", desc: "You know everyone's motive before the detective does. Justice is your genre." },
  "War & Politics": { label: "Strategic Mind", emoji: "⚔️", color: "#78716c", desc: "Power plays and battlefield tactics — you see the chess moves others miss." },
};

const FALLBACK_STYLE = { label: "Cinephile", emoji: "🎬", color: "#6366f1", desc: "Your taste defies categorization. You watch what moves you, and that's the purest kind of cinephilia." };

// Emoji + color per media type for slide backgrounds
const MEDIA_STYLES: Record<string, { emoji: string; label: string; gradient: string }> = {
  movie: { emoji: "🎥", label: "Movies", gradient: "from-[#1a1025] via-[#2d1a3d] to-[#1a1025]" },
  tv: { emoji: "📺", label: "TV Shows", gradient: "from-[#0f1a25] via-[#1a2d3d] to-[#0f1a25]" },
  anime: { emoji: "🌸", label: "Anime", gradient: "from-[#25101a] via-[#3d1a2d] to-[#25101a]" },
};

type MediaType = "movie" | "tv" | "anime";

export default function YearlyRecapSlideshow({
  hours, titles, ratingAvg, ratedCount, topGenre, topGenreCount,
  allGenres, topActors, displayName, mediaBreakdown, mediaHours,
  library, reviewsMap,
}: YearlyRecapSlideshowProps) {
  const year = new Date().getFullYear();
  const [activeSlide, setActiveSlide] = useState(0);
  const [dotsMounted, setDotsMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalSlides = 7;

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

  // Derive highest/lowest rated from library
  const ratedItems = library.filter(l => l.rating && l.rating > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const highestRated = ratedItems[0] || null;
  const lowestRated = ratedItems[ratedItems.length - 1] || null;
  const highestReview = highestRated ? reviewsMap[`${highestRated.tmdb_id}-${highestRated.media_type}`] || null : null;
  const lowestReview = lowestRated ? reviewsMap[`${lowestRated.tmdb_id}-${lowestRated.media_type}`] || null : null;

  // Posters for background collages per media type
  const getPostersForType = (mediaType: MediaType): string[] =>
    library
      .filter(l => l.media_type === mediaType && l.poster)
      .slice(0, 6)
      .map(l => l.poster!);

  const moviePosters = getPostersForType("movie");
  const tvPosters = getPostersForType("tv");
  const animePosters = getPostersForType("anime");

  // Genre style
  const styleProfile = GENRE_STYLES[topGenre] || FALLBACK_STYLE;

  // Raw counts
  const mediaCounts: { type: MediaType; count: number; hours: number; posters: string[]; style: typeof MEDIA_STYLES["movie"] }[] = [
    { type: "movie", count: mediaBreakdown.movie, hours: mediaHours.movie, posters: moviePosters, style: MEDIA_STYLES.movie },
    { type: "tv", count: mediaBreakdown.tv, hours: mediaHours.tv, posters: tvPosters, style: MEDIA_STYLES.tv },
    { type: "anime", count: mediaBreakdown.anime, hours: mediaHours.anime, posters: animePosters, style: MEDIA_STYLES.anime },
  ];

  // Total hours in days (fun stat for slide 1)
  const daysWatched = Math.round(hours / 24);
  const totalTitles = mediaBreakdown.movie + mediaBreakdown.tv + mediaBreakdown.anime;

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
        {/* ══════ Slide 1 — Intro ══════ */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center bg-gradient-to-br from-[#0f0f1a] via-[#1a0a2e] to-[#0f172a] min-h-[340px]">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 20%, rgba(99,102,241,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(168,85,247,0.3) 0%, transparent 50%)" }} />
          <div className="relative z-10 px-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-6">
              Your Year in Frames
            </p>
            <p className="text-7xl font-black text-white mb-3 tracking-tight">{year}</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-accent to-[#a855f7] bg-clip-text text-transparent">
              @{displayName}
            </p>
            <p className="text-sm text-white/40 mt-5 max-w-[240px] leading-relaxed">
              A year of stories, emotions, and unforgettable moments. Let's look back.
            </p>
            <div className="mt-8 pt-5 border-t border-white/10">
              <p className="text-[10px] text-white/30 uppercase tracking-[0.2em]">Swipe →</p>
            </div>
          </div>
        </div>

        {/* ══════ Slides 2–4 — Movies / TV / Anime ══════ */}
        {mediaCounts.map((m) => (
          <div key={m.type}
            className={`snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center min-h-[340px] bg-gradient-to-br ${m.style.gradient}`}
          >
            {/* Poster collage background */}
            {m.posters.length > 0 && (
              <div className="absolute inset-0 opacity-20">
                <div className="grid grid-cols-3 gap-1 p-4 h-full">
                  {m.posters.map((url, i) => (
                    <div key={i} className="rounded-md overflow-hidden bg-black/30">
                      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/60" />

            <div className="relative z-10 px-4">
              <span className="text-5xl block mb-3">{m.style.emoji}</span>
              <h3 className="text-2xl font-bold text-white mb-1">{m.style.label}</h3>
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="text-center">
                  <p className="text-3xl font-black text-white tabular-nums">{m.count || 0}</p>
                  <p className="text-[10px] text-white/60 uppercase tracking-wide">titles</p>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div className="text-center">
                  <p className="text-3xl font-black text-white tabular-nums">{m.hours || 0}</p>
                  <p className="text-[10px] text-white/60 uppercase tracking-wide">hours</p>
                </div>
              </div>
              {m.count > 0 && m.hours > 0 && (
                <p className="text-xs text-white/40 mt-3">
                  ~{Math.round(m.hours / Math.max(m.count, 1))}h per title avg
                </p>
              )}
            </div>
          </div>
        ))}

        {/* ══════ Slide 5 — Highest Rated ══════ */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl bg-bg-card border border-border p-6 flex flex-col min-h-[340px]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-yellow-400 mb-4">Your Crown Jewel</p>
          {highestRated ? (
            <div className="flex-1 flex flex-col items-center text-center">
              <div className="w-28 h-[168px] rounded-xl overflow-hidden bg-bg-primary mb-4 shadow-lg">
                {highestRated.poster ? (
                  <img src={highestRated.poster} alt={highestRated.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>
                )}
              </div>
              <h3 className="text-lg font-bold text-text-primary">{highestRated.title}</h3>
              {highestRated.year && <p className="text-xs text-text-secondary">{highestRated.year}</p>}
              <div className="flex items-center gap-1 mt-2">
                <span className="text-2xl font-black text-yellow-400">★{highestRated.rating}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-border w-full">
                {highestReview ? (
                  <p className="text-xs text-text-secondary italic line-clamp-2">
                    &ldquo;{highestReview}&rdquo;
                  </p>
                ) : (
                  <p className="text-[10px] text-text-secondary">No review written</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-text-secondary">No ratings yet this year</p>
            </div>
          )}
        </div>

        {/* ══════ Slide 6 — Lowest Rated ══════ */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl bg-bg-card border border-border p-6 flex flex-col min-h-[340px]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-4">Not Your Cup of Tea</p>
          {lowestRated ? (
            <div className="flex-1 flex flex-col items-center text-center">
              <div className="w-28 h-[168px] rounded-xl overflow-hidden bg-bg-primary mb-4 shadow-lg opacity-80">
                {lowestRated.poster ? (
                  <img src={lowestRated.poster} alt={lowestRated.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>
                )}
              </div>
              <h3 className="text-lg font-bold text-text-primary">{lowestRated.title}</h3>
              {lowestRated.year && <p className="text-xs text-text-secondary">{lowestRated.year}</p>}
              <div className="flex items-center gap-1 mt-2">
                <span className="text-2xl font-black text-red-400">★{lowestRated.rating}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-border w-full">
                {lowestReview ? (
                  <p className="text-xs text-text-secondary italic line-clamp-2">
                    &ldquo;{lowestReview}&rdquo;
                  </p>
                ) : (
                  <p className="text-[10px] text-text-secondary">No review written</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-text-secondary">No ratings yet this year</p>
            </div>
          )}
        </div>

        {/* ══════ Slide 7 — Your Style ══════ */}
        <div className="snap-center shrink-0 w-[85vw] max-w-md mr-3 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center text-center min-h-[340px]"
             style={{ background: `linear-gradient(135deg, ${styleProfile.color}22, ${styleProfile.color}11, #0f0f1a)` }}>
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <span className="text-[12rem]">{styleProfile.emoji}</span>
          </div>
          <div className="relative z-10 px-4">
            <span className="text-6xl block mb-4">{styleProfile.emoji}</span>
            <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mb-2">Your {year} Style</p>
            <h3 className="text-3xl font-black text-text-primary mb-3">{styleProfile.label}</h3>
            <p className="text-sm text-text-secondary max-w-[260px] leading-relaxed">
              {styleProfile.desc}
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <span className="px-3 py-1.5 rounded-full bg-accent/20 text-accent text-xs font-medium">
                {topGenre} · {topGenreCount} titles
              </span>
              {allGenres[1] && (
                <span className="px-3 py-1.5 rounded-full bg-bg-primary text-text-secondary text-xs">
                  {allGenres[1].name} · {allGenres[1].count}
                </span>
              )}
            </div>
            {/* Mini share button */}
            <div className="mt-6">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-[#818cf8] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share My Recap
              </button>
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
