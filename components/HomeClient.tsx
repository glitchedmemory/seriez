"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { PosterCard, HorizontalScroll } from "@/components/PosterCard";
import { HeroCard } from "@/components/HeroCard";
import { StreamingTop10 } from "@/components/StreamingTop10";
import PosterImage from "@/components/PosterImage";
import type { TmdbResult } from "@/lib/tmdb";

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="text-gold text-sm">
      {"★".repeat(full)}{half && "½"}{"☆".repeat(empty)}
    </span>
  );
}

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{emoji}</span>
      <div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        <p className="text-[11px] text-text-secondary">{subtitle}</p>
      </div>
    </div>
  );
}

function PosterGrid({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="md:hidden flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x snap-mandatory">{children}</div>
      <div className="hidden md:grid grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 px-4 md:px-0">{children}</div>
    </>
  );
}

function CardWrapper({ item, reasonText, showCountdown }: { item: TmdbResult; reasonText?: string; showCountdown?: boolean }) {
  return (
    <a href={`/title/${item.id}?type=${item.type}`} className="flex-shrink-0 w-32 md:w-auto block snap-start">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-bg-card group md:hover:scale-105 transition-transform">
        <PosterImage src={item.poster} alt={item.title} fill className="rounded-xl" sizes="(max-width: 768px) 128px, 200px" />
        {showCountdown && item.daysUntil && (
          <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold text-text-primary ${
            item.daysUntil <= 7 ? "bg-red-500" : item.daysUntil <= 30 ? "bg-amber-500" : "bg-emerald-500"
          }`}>
            {item.daysUntil}d
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-gold">
          ★ {item.rating || "—"}
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-[11px] font-medium text-text-primary leading-tight line-clamp-2">{item.title}</p>
        </div>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        {item.year} · {item.type === "movie" ? "Movie" : item.type === "tv" ? "TV" : "Anime"}
      </p>
      {reasonText && (
        <p className="text-[10px] text-accent mt-0.5 line-clamp-1">
          {reasonText}
        </p>
      )}
    </a>
  );
}

function BoxOfficeCard({ movie, rank }: { movie: TmdbResult; rank: number }) {
  return (
    <a href={`/title/${movie.id}?type=${movie.type}`} className="flex-shrink-0 w-36 md:w-40 block snap-start group">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-bg-card md:group-hover:scale-105 transition-transform">
        <PosterImage src={movie.poster} alt={movie.title} fill className="rounded-xl" sizes="(max-width: 768px) 144px, 160px" />
        <div className={`absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-text-primary shadow-lg ${
          rank === 1 ? "bg-gold" : rank === 2 ? "bg-[#9ca3af]" : rank === 3 ? "bg-amber-700" : "bg-[#2d2d4a] text-text-secondary"
        }`}>
          {rank}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-[12px] font-semibold text-text-primary leading-tight line-clamp-2">{movie.title}</p>
          <p className="text-[10px] text-text-secondary mt-0.5">{movie.year} · ★ {movie.rating}</p>
        </div>
      </div>
    </a>
  );
}

interface Props {
  trending: TmdbResult[];
  upcoming: TmdbResult[];
  animeUpcoming: TmdbResult[];
  boxOffice: TmdbResult[];
  region: string;
  randomSeed: number;
  curatedHero?: TmdbResult;
  curatedNextHero?: TmdbResult;
}

type TrendingMode = "movie" | "tv" | "anime";

function getStoredMode(): TrendingMode {
  if (typeof window === "undefined") return "anime";
  const stored = localStorage.getItem("seriez-trending-mode");
  if (stored === "movie" || stored === "tv" || stored === "anime") return stored;
  return "anime";
}

export default function HomeClient({ trending, upcoming, animeUpcoming, boxOffice, region, randomSeed, curatedHero, curatedNextHero }: Props) {
  const [trendingMode, setTrendingMode] = useState<TrendingMode>(getStoredMode);
  const [animeTrending, setAnimeTrending] = useState<TmdbResult[]>([]);
  const [animeLoading, setAnimeLoading] = useState(false);

  // Inline search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TmdbResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(query: string) {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) { setSearchResults([]); setSearchLoading(false); return; }
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 100);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchLoading(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  // Persist trending mode to localStorage
  const switchTrendingMode = useCallback((mode: TrendingMode) => {
    setTrendingMode(mode);
    localStorage.setItem("seriez-trending-mode", mode);
  }, []);

  // "For You" personalized recommendations
  const [forYouLoading, setForYouLoading] = useState(false);
  const [forYouItems, setForYouItems] = useState<TmdbResult[] | null>(null);
  const [forYouGenres, setForYouGenres] = useState<string[]>([]);
  const [forYouReason, setForYouReason] = useState("");
  const [forYouReasons, setForYouReasons] = useState<Record<number, string>>({});
  const [seriezUsername, setSeriezUsername] = useState<string>("");
  const [isPremium, setIsPremium] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uname = session?.user?.user_metadata?.username;
      if (uname) {
        setSeriezUsername(uname);
        fetchForYou(uname);
        fetch(`/api/profile?username=${encodeURIComponent(uname)}`)
          .then((r) => r.json())
          .then((data) => setIsPremium(data.is_premium || false))
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Fetch anime trending on toggle
  useEffect(() => {
    if (trendingMode !== "anime" || animeTrending.length > 0) return;
    setAnimeLoading(true);
    fetch("/api/anime-trending")
      .then(r => r.json())
      .then(data => { setAnimeTrending(data.results || []); setAnimeLoading(false); })
      .catch(() => setAnimeLoading(false));
  }, [trendingMode, animeTrending.length]);

  // hero: random pick from trending pool (includes movies + TV + anime)
  const heroPick = useMemo(() => {
    if (trending.length === 0) return 0;
    return randomSeed % trending.length;
  }, [randomSeed, trending.length]);
  const hero = trending[heroPick];
  const nextHero = curatedNextHero || trending.filter((_, i) => i !== heroPick).slice(0, 1)[0];

  // Shared search results dropdown
  const searchDropdown = searchOpen && searchQuery.trim() ? (
    <div className="absolute top-full left-0 right-0 mt-1 bg-bg-primary border border-border rounded-xl overflow-hidden z-50 max-h-80 overflow-y-auto shadow-2xl">
      {searchLoading ? (
        <div className="p-4 text-center text-sm text-text-secondary">Searching...</div>
      ) : searchResults.length > 0 ? (
        searchResults.map((item) => (
          <a
            key={`${item.type}-${item.id}`}
            href={`/title/${item.id}?type=${item.type}`}
            onClick={closeSearch}
            className="flex items-center gap-3 p-3 hover:bg-bg-card transition-colors border-b border-border last:border-0"
          >
            <div className="w-10 h-[60px] rounded-lg overflow-hidden bg-bg-card flex-shrink-0 relative">
              <PosterImage src={item.poster} alt="" fill className="rounded-lg" sizes="40px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-primary truncate">{item.title}</p>
              <p className="text-xs text-text-secondary">
                {item.year} · {item.type === "movie" ? "Movie" : item.type === "tv" ? "TV" : "Anime"} · ★ {item.rating}
              </p>
              {item.genres?.length > 0 && (
                <p className="text-[10px] text-accent/70 mt-0.5">{item.genres.join(", ")}</p>
              )}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-text-secondary flex-shrink-0">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </a>
        ))
      ) : (
        <div className="p-4 text-center text-sm text-text-secondary">No results found</div>
      )}
    </div>
  ) : null;

  return (
    <div className="max-w-lg md:max-w-none mx-auto min-h-screen">
      {/* ── Mobile header ── */}
      <header className="md:hidden sticky top-0 z-40 bg-bg-primary/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-border">
        {searchOpen ? (
          <div className="flex-1 flex items-center gap-2 relative">
            <button
              onClick={closeSearch}
              className="text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
              aria-label="Close search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search movies, TV, anime..."
                className="w-full bg-bg-card text-text-primary text-sm rounded-lg px-3 py-2 outline-none border border-border focus:border-accent transition-colors placeholder:text-text-secondary"
                autoFocus
              />
              {searchDropdown}
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">Seriez</h1>
            <button onClick={() => setSearchOpen(true)} className="text-text-secondary hover:text-text-primary transition-colors" aria-label="Search">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}
      </header>

      <div className="md:flex md:gap-6 md:px-4 md:pt-6">
        <div className="md:flex-1 md:min-w-0 md:space-y-8">
          {hero && <HeroCard item={hero} nextItem={nextHero} region={region} isPremium={isPremium} />}

          <section>
            <div className="px-4 md:px-0 mb-3">
              <SectionHeader emoji="🎯" title="For You" subtitle={"Based on what you liked"} />
            </div>
            <PosterGrid>
              {forYouLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[2/3] bg-bg-card-hover rounded-lg" />
                  </div>
                ))
              ) : (
                (forYouItems && forYouItems.length > 0
                  ? forYouItems.slice(0, 14)
                  : trending.slice(0, 14)
                ).map((item) => (
                  <CardWrapper key={item.id} item={item} reasonText={forYouReasons[item.id] && !["Recommended for you","Trending this week"].includes(forYouReasons[item.id]) ? forYouReasons[item.id] : undefined} />
                ))
              )}
            </PosterGrid>
          </section>

          <section>
            <div className="px-4 md:px-0 mb-3">
              <SectionHeader emoji="⏳" title="Coming Soon" subtitle="Movies, TV & Anime" />
            </div>
            <PosterGrid>
              {[...upcoming.map((item) => <CardWrapper key={`tmdb-${item.id}`} item={item} showCountdown />), ...animeUpcoming.map((item) => <CardWrapper key={`anilist-${item.id}`} item={item} />)].slice(0, 14)}
            </PosterGrid>
          </section>

          <section>
            <div className="px-4 md:px-0 mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Trending This Week</h2>
                    <p className="text-[11px] text-text-secondary">Most popular {trendingMode === "movie" ? "movies" : trendingMode === "tv" ? "TV" : "anime"}</p>
                  </div>
                </div>
                {/* 3-way Toggle Switch */}
                <div className="ml-auto relative flex-shrink-0 w-[168px] h-8 rounded-full bg-bg-card border border-border overflow-hidden">
                  <div className={`absolute top-[3px] h-[26px] w-[52px] rounded-full bg-accent transition-transform duration-300 ease-out pointer-events-none ${
                    trendingMode === "movie" ? "translate-x-[3px]" : trendingMode === "tv" ? "translate-x-[58px]" : "translate-x-[113px]"
                  }`} />
                  <button
                    onClick={() => switchTrendingMode("movie")}
                    className={`absolute left-0 top-0 w-[56px] h-full flex items-center justify-center text-[10px] font-semibold transition-colors duration-300 hover:bg-white/5 ${
                      trendingMode === "movie" ? "text-text-primary light:text-white" : "text-text-secondary"
                    }`}
                    aria-label="Show trending movies"
                  >🎬 Movies</button>
                  <button
                    onClick={() => switchTrendingMode("tv")}
                    className={`absolute left-[56px] top-0 w-[56px] h-full flex items-center justify-center text-[10px] font-semibold transition-colors duration-300 hover:bg-white/5 ${
                      trendingMode === "tv" ? "text-text-primary light:text-white" : "text-text-secondary"
                    }`}
                    aria-label="Show trending TV"
                  >📺 TV</button>
                  <button
                    onClick={() => switchTrendingMode("anime")}
                    className={`absolute left-[112px] top-0 w-[56px] h-full flex items-center justify-center text-[10px] font-semibold transition-colors duration-300 hover:bg-white/5 ${
                      trendingMode === "anime" ? "text-text-primary light:text-white" : "text-text-secondary"
                    }`}
                    aria-label="Show trending anime"
                  >🍿 Anime</button>
                </div>
              </div>
            </div>
            {trendingMode === "anime" ? (
              animeLoading ? (
                <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-32">
                      <div className="aspect-[2/3] rounded-xl bg-bg-card animate-pulse" />
                      <div className="mt-1 h-3 w-20 bg-bg-card rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <PosterGrid>
                  {animeTrending.slice(0, 14).map((item) => <CardWrapper key={item.id} item={item} />)}
                </PosterGrid>
              )
            ) : (
              <PosterGrid>
                {trending
                  .filter(item => item.type === trendingMode)
                  .slice(0, 14)
                  .map((item) => <CardWrapper key={item.id} item={item} />)}
              </PosterGrid>
            )}
          </section>

          <section>
            <div className="px-4 md:px-0 mb-3">
              <SectionHeader emoji="🎬" title={`Box Office · ${region}`} subtitle="Weekend Top 10" />
            </div>
            <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x snap-mandatory">
              {boxOffice.map((movie, i) => (
                <BoxOfficeCard key={movie.id} movie={movie} rank={i + 1} />
              ))}
            </div>
          </section>

          <div className="h-4" />
        </div>

          {/* Desktop Sidebar */}
        <aside className="hidden md:block w-72 lg:w-80 flex-shrink-0 space-y-5">
          {/* Inline Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { handleSearchChange(e.target.value); if (!searchOpen) setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search movies, TV, anime..."
              className="w-full bg-bg-card text-text-primary text-sm rounded-xl px-4 py-2.5 pl-10 outline-none border border-border focus:border-accent transition-colors placeholder:text-text-secondary"
            />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-text-secondary absolute left-3.5 top-3">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            {searchDropdown}
          </div>

          {/* Streaming Top 10 */}
          <StreamingTop10 />
        </aside>
      </div>
    </div>
  );
}
