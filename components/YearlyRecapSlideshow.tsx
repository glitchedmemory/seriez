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
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startScrollLeft: number; moved: boolean; dragging: boolean }>({
    startX: 0, startScrollLeft: 0, moved: false, dragging: false,
  });
  const totalSlides = 7;

  // ── Mouse wheel → horizontal scroll (native-like, same feel as touch swipe) ──
  // React's onWheel is registered passive (cannot preventDefault), so attach a
  // non-passive native listener directly to convert vertical wheel into
  // horizontal scrolling — smooth, with CSS snap handling the rest.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Actual slide width (offsetWidth + right margin) — the container clientWidth
  // does NOT equal one slide width on desktop (slides are w-[85vw] max-w-md),
  // so divide by the real slide step to compute the correct slide index.
  const getSlideStep = (el: HTMLElement): number => {
    const first = el.children[0] as HTMLElement | undefined;
    if (!first) return el.clientWidth || 300;
    const style = getComputedStyle(first);
    const marginRight = parseFloat(style.marginRight) || 0;
    return first.offsetWidth + marginRight;
  };

  // Snap-to-center scroll position for a slide. Slides use `snap-center`, so the
  // browser aligns the slide's center to the container's center. That equals
  // slide.offsetLeft - (container.clientWidth - slide.offsetWidth)/2.
  const getSnapLeft = (el: HTMLElement, index: number): number => {
    const slide = el.children[index] as HTMLElement | undefined;
    if (!slide) return index * getSlideStep(el);
    const containerW = el.clientWidth;
    const slideW = slide.offsetWidth;
    const offset = Math.max(0, Math.floor((containerW - slideW) / 2));
    return Math.max(0, slide.offsetLeft - offset);
  };

  // ── Desktop drag-to-swipe (mouse only — touch keeps native swipe) ──
  // IMPORTANT: dragging NEVER touches React state. setIsDragging re-renders the
  // component and re-applies scroll-snap-mandatory mid-drag, which fights the
  // drag and makes it stutter/stop before reaching the next slide. Everything
  // here is driven purely by the DOM via inline styles + event handlers on the
  // scroller (see the wheel listener and pointer handlers bound at the JSX).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = { startX: e.clientX, startScrollLeft: el.scrollLeft, moved: false, dragging: true };
    // Disable snap directly on the DOM — no re-render involved.
    el.style.scrollSnapType = "none";
    el.style.scrollBehavior = "auto"; // ensure instant following, no smooth animation mid-drag
    el.classList.add("dragging-grabbing");
    try { el.setPointerCapture(e.pointerId); } catch { /* non-fatal */ }
    el.setAttribute("data-dragging", "true");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    const el = scrollRef.current;
    if (!el) return;
    // ONLY act when the user is actively holding the mouse button down (dragging).
    // Without this guard, pointermove fires on hover too and (using stale startX/
    // startScrollLeft from the last drag) yanks the scroller around on its own.
    if (!drag.dragging) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(dx) <= 5) return; // still within click threshold
      drag.moved = true; // promote to drag
    }
    // Carry the content in the direction the mouse moves: dragging the mouse
    // to the RIGHT should pull the NEXT slide into view (scrollLeft increases).
    // scrollLeft = startScrollLeft - dx was inverted (mouse right → scroll left
    // → slides go backward) and hit the scroll boundary, so dragging right
    // appeared to "stop".
    el.scrollLeft = drag.startScrollLeft + dx;
  };

  const endDrag = () => {
    const drag = dragState.current;
    const el = scrollRef.current;
    if (!el) return;
    const wasMoved = drag.moved;
    // Restore inline overrides / classes first.
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
    el.classList.remove("dragging-grabbing");
    el.removeAttribute("data-dragging");
    drag.dragging = false;
    drag.moved = false;
    if (wasMoved) {
      // Compute the exact target slide from how far the drag actually travelled,
      // then scroll directly to its snap-to-center position. We do NOT rely on
      // native scroll-snap here: mandatory snap would snap back to the grid
      // position and reverse the drag. compute nearest index from final scroll.
      const idx = Math.round(el.scrollLeft / getSlideStep(el));
      const targetLeft = getSnapLeft(el, idx);
      // Do the centering scroll with snap temporarily off to avoid a double move.
      el.style.scrollSnapType = "none";
      el.scrollTo({ left: targetLeft, behavior: "smooth" });
      // Re-enable snap AFTER the scroll finishes so subsequent swipes work again.
      window.setTimeout(() => { el.style.scrollSnapType = ""; }, 350);
    }
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

  // Simple deterministic hash for seeding "random" picks
  const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  // Pick item from the dominant media type among a pool — deterministic random
  const pickFromDominantType = (pool: typeof library, seed: string) => {
    if (pool.length === 0) return null;
    // Count by media type
    const counts: Record<string, number> = {};
    pool.forEach(item => { counts[item.media_type] = (counts[item.media_type] || 0) + 1; });
    // Find dominant type (most items)
    let dominantType = pool[0].media_type;
    let maxCount = 0;
    for (const [type, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; dominantType = type; }
    }
    const candidates = pool.filter(i => i.media_type === dominantType);
    return candidates[simpleHash(seed + dominantType) % candidates.length];
  };

  // Derive highest/lowest rated from library — dominant media type logic
  const ratedItems = library.filter(l => l.rating && l.rating > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  // High-rated pool: rating >= 4, fallback to top 25% if too few
  const highRated = ratedItems.filter(i => (i.rating || 0) >= 4);
  const highPool = highRated.length >= 2 ? highRated : ratedItems.slice(0, Math.max(1, Math.ceil(ratedItems.length * 0.25)));
  // Low-rated pool: rating <= 2, fallback to bottom 25% if too few
  const lowRated = ratedItems.filter(i => (i.rating || 0) <= 2);
  const lowPool = lowRated.length >= 2 ? lowRated : ratedItems.slice(-Math.max(1, Math.ceil(ratedItems.length * 0.25)));
  const seed = displayName + String(new Date().getFullYear());
  const highestRated = pickFromDominantType(highPool, seed + "high") || ratedItems[0] || null;
  const lowestRated = pickFromDominantType(lowPool, seed + "low") || ratedItems[ratedItems.length - 1] || null;
  const highestReview = highestRated ? reviewsMap[`${highestRated.tmdb_id}-${highestRated.media_type}`] || null : null;
  const lowestReview = lowestRated ? reviewsMap[`${lowestRated.tmdb_id}-${lowestRated.media_type}`] || null : null;

  // Fetch popular posters from TMDB for background collages
  const [popularPosters, setPopularPosters] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchPosters = async () => {
      try {
        const [movieRes, tvRes, animeRes] = await Promise.all([
          fetch(`/api/tmdb/year-posters?year=${year}&type=movie`).then(r => r.json()),
          fetch(`/api/tmdb/year-posters?year=${year}&type=tv`).then(r => r.json()),
          fetch(`/api/tmdb/year-posters?year=${year}&type=anime`).then(r => r.json()),
        ]);
        setPopularPosters({
          movie: movieRes.posters || [],
          tv: tvRes.posters || [],
          anime: animeRes.posters || [],
        });
      } catch {}
    };
    fetchPosters();
  }, [year]);

  // Posters for background collages per media type (library fallback → TMDB popular)
  const getPostersForType = (mediaType: MediaType): string[] => {
    const libPosters = library
      .filter(l => l.media_type === mediaType && l.poster)
      .slice(0, 6)
      .map(l => l.poster!);
    const tmdbPosters = popularPosters[mediaType] || [];
    // Use TMDB popular if available, fallback to library
    return tmdbPosters.length > 0 ? tmdbPosters : libPosters;
  };

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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex overflow-x-auto -mx-4 px-4 cursor-grab select-none snap-x snap-mandatory"
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
              <div className="absolute inset-0 opacity-50">
                <div className="grid grid-cols-3 gap-1 p-3 h-full">
                  {m.posters.map((url, i) => (
                    <div key={i} className="rounded-md overflow-hidden">
                      <img src={url} alt="" draggable={false} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/45" />

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
                  <img src={highestRated.poster} alt={highestRated.title} draggable={false} className="w-full h-full object-cover" />
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
                  <img src={lowestRated.poster} alt={lowestRated.title} draggable={false} className="w-full h-full object-cover" />
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
          {/* Genre-specific background image */}
          <div className="absolute inset-0" style={{
            backgroundImage: `url(/recap-${topGenre.toLowerCase().replace(/[^a-z0-9]/g, "")}-bg.webp), url(/recap-genre-bg.webp)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.45,
          }} />
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <span className="text-[12rem]">{styleProfile.emoji}</span>
          </div>
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative z-10 px-4">
            <span className="text-6xl block mb-4">{styleProfile.emoji}</span>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2">Your {year} Style</p>
            <h3 className="text-3xl font-black text-white mb-3">{styleProfile.label}</h3>
            <p className="text-sm text-white/70 max-w-[260px] leading-relaxed">
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
    </div>
  );
}
