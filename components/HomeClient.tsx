"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { PosterCard, HorizontalScroll } from "@/components/PosterCard";
import { HeroCard } from "@/components/HeroCard";
import { GenreChips } from "@/components/GenreChips";
import PosterImage from "@/components/PosterImage";
import type { TmdbResult } from "@/lib/tmdb";

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="text-[#f59e0b] text-sm">
      {"★".repeat(full)}{half && "½"}{"☆".repeat(empty)}
    </span>
  );
}

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{emoji}</span>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="text-[11px] text-[#6b7280]">{subtitle}</p>
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
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#1a1a2e] group md:hover:scale-105 transition-transform">
        <PosterImage src={item.poster} alt={item.title} fill className="rounded-xl" sizes="(max-width: 768px) 128px, 200px" />
        {showCountdown && item.daysUntil && (
          <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
            item.daysUntil <= 7 ? "bg-red-500" : item.daysUntil <= 30 ? "bg-amber-500" : "bg-emerald-500"
          }`}>
            {item.daysUntil}d
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-[#f59e0b]">
          ★ {item.rating || "—"}
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-[11px] font-medium text-white leading-tight line-clamp-2">{item.title}</p>
        </div>
      </div>
      <p className="mt-1 text-xs text-[#9ca3af]">
        {item.year} · {item.type === "movie" ? "Movie" : "TV"}
      </p>
      {reasonText && (
        <p className="text-[10px] text-[#6366f1] mt-0.5 line-clamp-1">
          {reasonText}
        </p>
      )}
    </a>
  );
}

function BoxOfficeCard({ movie, rank }: { movie: TmdbResult; rank: number }) {
  return (
    <a href={`/title/${movie.id}?type=${movie.type}`} className="flex-shrink-0 w-36 md:w-40 block snap-start group">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#1a1a2e] md:group-hover:scale-105 transition-transform">
        <PosterImage src={movie.poster} alt={movie.title} fill className="rounded-xl" sizes="(max-width: 768px) 144px, 160px" />
        <div className={`absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white shadow-lg ${
          rank === 1 ? "bg-[#f59e0b]" : rank === 2 ? "bg-[#9ca3af]" : rank === 3 ? "bg-amber-700" : "bg-[#2d2d4a] text-[#6b7280]"
        }`}>
          {rank}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-[12px] font-semibold text-white leading-tight line-clamp-2">{movie.title}</p>
          <p className="text-[10px] text-[#9ca3af] mt-0.5">{movie.year} · ★ {movie.rating}</p>
        </div>
      </div>
    </a>
  );
}

interface Props {
  trending: TmdbResult[];
  upcoming: TmdbResult[];
  boxOffice: TmdbResult[];
  region: string;
  randomSeed: number;
}

type TrendingMode = "movie" | "tv" | "anime";

function getStoredMode(): TrendingMode {
  if (typeof window === "undefined") return "anime";
  const stored = localStorage.getItem("seriez-trending-mode");
  if (stored === "movie" || stored === "tv" || stored === "anime") return stored;
  return "anime";
}

export default function HomeClient({ trending, upcoming, boxOffice, region, randomSeed }: Props) {
  const [activeGenre, setActiveGenre] = useState("All");
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
  const [forYouItems, setForYouItems] = useState<TmdbResult[] | null>(null);
  const [forYouGenres, setForYouGenres] = useState<string[]>([]);
  const [forYouReason, setForYouReason] = useState("");
  const [forYouReasons, setForYouReasons] = useState<Record<number, string>>({});

  useEffect(() => {
    const username = localStorage.getItem("seriez-username");
    if (!username) {
      setForYouItems([]);
      return;
    }
    fetch(`/api/for-you?username=${encodeURIComponent(username)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.items?.length) {
          setForYouItems(data.items);
          setForYouGenres(data.genres || []);
          setForYouReasons(data.reasons || {});
        } else {
          setForYouItems([]);
          setForYouReason(data.reason || "Rate some titles to see recommendations");
        }
      })
      .catch(() => {
        setForYouItems([]);
        setForYouReason("Recommendations unavailable right now");
      });
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

  // Random hero pick using server-provided seed
  const heroPick = useMemo(() => {
    if (trending.length === 0) return 0;
    return randomSeed % trending.length;
  }, [randomSeed, trending.length]);
  const hero = trending[heroPick];
  const nextHero = trending.filter((_, i) => i !== heroPick).slice(0, 1)[0];

  // Shared search results dropdown
  const searchDropdown = searchOpen && searchQuery.trim() ? (
    <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f0f1a] border border-[#2d2d4a] rounded-xl overflow-hidden z-50 max-h-80 overflow-y-auto shadow-2xl">
      {searchLoading ? (
        <div className="p-4 text-center text-sm text-[#6b7280]">Searching...</div>
      ) : searchResults.length > 0 ? (
        searchResults.map((item) => (
          <a
            key={`${item.type}-${item.id}`}
            href={`/title/${item.id}?type=${item.type}`}
            onClick={closeSearch}
            className="flex items-center gap-3 p-3 hover:bg-[#1a1a2e] transition-colors border-b border-[#1a1a2e] last:border-0"
          >
            <div className="w-10 h-[60px] rounded-lg overflow-hidden bg-[#1a1a2e] flex-shrink-0 relative">
              <PosterImage src={item.poster} alt="" fill className="rounded-lg" sizes="40px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{item.title}</p>
              <p className="text-xs text-[#6b7280]">
                {item.year} · {item.type === "movie" ? "Movie" : item.type === "tv" ? "TV" : "Anime"} · ★ {item.rating}
              </p>
              {item.genres?.length > 0 && (
                <p className="text-[10px] text-[#6366f1]/70 mt-0.5">{item.genres.join(", ")}</p>
              )}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#6b7280] flex-shrink-0">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </a>
        ))
      ) : (
        <div className="p-4 text-center text-sm text-[#6b7280]">No results found</div>
      )}
    </div>
  ) : null;

  return (
    <div className="max-w-lg md:max-w-none mx-auto min-h-screen">
      {/* ── Mobile header ── */}
      <header className="md:hidden sticky top-0 z-40 bg-[#0f0f1a]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[#1a1a2e]">
        {searchOpen ? (
          <div className="flex-1 flex items-center gap-2 relative">
            <button
              onClick={closeSearch}
              className="text-[#9ca3af] hover:text-white transition-colors flex-shrink-0"
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
                className="w-full bg-[#1a1a2e] text-white text-sm rounded-lg px-3 py-2 outline-none border border-[#2d2d4a] focus:border-[#6366f1] transition-colors placeholder:text-[#6b7280]"
                autoFocus
              />
              {searchDropdown}
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">Seriez</h1>
            <button onClick={() => setSearchOpen(true)} className="text-[#9ca3af] hover:text-white transition-colors" aria-label="Search">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}
      </header>

      <div className="md:flex md:gap-6 md:px-4 md:pt-6">
        <div className="md:flex-1 md:min-w-0 md:space-y-8">
          {hero && <HeroCard item={hero} nextItem={nextHero} region={region} />}

          <section>
            <div className="px-4 md:px-0 mb-3">
              <SectionHeader emoji="⏳" title="Coming Soon" subtitle="Upcoming releases" />
            </div>
            <PosterGrid>
              {upcoming.map((item) => <CardWrapper key={item.id} item={item} showCountdown />)}
            </PosterGrid>
          </section>

          <GenreChips selected={activeGenre} onSelect={setActiveGenre} />

          <section>
            <div className="px-4 md:px-0 mb-3">
              <SectionHeader emoji="🎯" title="For You" subtitle={
                forYouItems === null
                  ? "Loading..."
                  : forYouGenres.length > 0
                  ? `Because you like ${forYouGenres.join(", ")}`
                  : forYouReason || "Based on your ratings"
              } />
            </div>
            <PosterGrid>
              {(forYouItems && forYouItems.length > 0
                ? forYouItems.slice(0, 14)
                : trending.slice(0, 14)
              ).map((item) => (
                <CardWrapper key={item.id} item={item} reasonText={forYouReasons[item.id]} />
              ))}
            </PosterGrid>
          </section>

          {/* ── AdSense Placeholder ── */}
          <div className="px-4 md:px-0 my-6">
            <div className="w-full h-[100px] rounded-xl border-2 border-dashed border-[#6366f1]/40 bg-[#1a1a2e]/50 flex flex-col items-center justify-center text-[#6b7280] text-xs gap-1">
              <span className="text-base">📢</span>
              <span className="font-medium text-[#9ca3af]">AdSense Banner</span>
              <span>320×100 / 300×250 responsive</span>
            </div>
          </div>

          <section>
            <div className="px-4 md:px-0 mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <div>
                    <h2 className="text-base font-semibold text-white">Trending This Week</h2>
                    <p className="text-[11px] text-[#6b7280]">Most popular {trendingMode === "movie" ? "movies" : trendingMode === "tv" ? "TV" : "anime"}</p>
                  </div>
                </div>
                {/* 3-way Toggle Switch */}
                <div className="ml-auto relative flex-shrink-0 w-[168px] h-8 rounded-full bg-[#1a1a2e] border border-[#2d2d4a] overflow-hidden">
                  <div className={`absolute top-[3px] h-[26px] w-[52px] rounded-full bg-[#6366f1] transition-transform duration-300 ease-out pointer-events-none ${
                    trendingMode === "movie" ? "translate-x-[3px]" : trendingMode === "tv" ? "translate-x-[58px]" : "translate-x-[113px]"
                  }`} />
                  <button
                    onClick={() => switchTrendingMode("movie")}
                    className={`absolute left-0 top-0 w-[56px] h-full flex items-center justify-center text-[10px] font-semibold transition-colors duration-300 hover:bg-white/5 ${
                      trendingMode === "movie" ? "text-white" : "text-[#6b7280]"
                    }`}
                    aria-label="Show trending movies"
                  >🎬 Movies</button>
                  <button
                    onClick={() => switchTrendingMode("tv")}
                    className={`absolute left-[56px] top-0 w-[56px] h-full flex items-center justify-center text-[10px] font-semibold transition-colors duration-300 hover:bg-white/5 ${
                      trendingMode === "tv" ? "text-white" : "text-[#6b7280]"
                    }`}
                    aria-label="Show trending TV"
                  >📺 TV</button>
                  <button
                    onClick={() => switchTrendingMode("anime")}
                    className={`absolute left-[112px] top-0 w-[56px] h-full flex items-center justify-center text-[10px] font-semibold transition-colors duration-300 hover:bg-white/5 ${
                      trendingMode === "anime" ? "text-white" : "text-[#6b7280]"
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
                      <div className="aspect-[2/3] rounded-xl bg-[#1a1a2e] animate-pulse" />
                      <div className="mt-1 h-3 w-20 bg-[#1a1a2e] rounded animate-pulse" />
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
              <SectionHeader emoji="🎬" title={`Box Office · ${region}`} subtitle="Now playing in theaters" />
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
              className="w-full bg-[#1a1a2e] text-white text-sm rounded-xl px-4 py-2.5 pl-10 outline-none border border-[#2d2d4a] focus:border-[#6366f1] transition-colors placeholder:text-[#6b7280]"
            />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#6b7280] absolute left-3.5 top-3">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            {searchDropdown}
          </div>

          {/* Streaming Top 10 */}
          <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-1">📺 Streaming Top 10</h3>
            <p className="text-[11px] text-[#6b7280] leading-relaxed">
              Real-time streaming charts coming soon — Netflix, Disney+, and more.
            </p>
            <div className="mt-3 flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex-1 h-1 rounded-full bg-[#2d2d4a]">
                  <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${30 + i * 25}%` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Trending sidebar with posters */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <span>🔥</span> Trending
            </h3>
            <div className="space-y-2">
              {trending.slice(0, 7).map((item, i) => (
                <a
                  key={item.id}
                  href={`/title/${item.id}?type=${item.type}`}
                  className="flex items-center gap-3 bg-[#1a1a2e] rounded-xl p-2 hover:bg-[#25253a] transition-colors group"
                >
                  <span className={`text-xs font-bold w-5 text-center flex-shrink-0 ${
                    i === 0 ? "text-[#f59e0b]" : i === 1 ? "text-[#9ca3af]" : "text-[#6b7280]"
                  }`}>{i + 1}</span>
                  <div className="w-9 h-[54px] rounded-lg overflow-hidden bg-[#0f0f1a] flex-shrink-0 relative">
                    <PosterImage src={item.poster} alt="" fill className="rounded-lg" sizes="36px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-white truncate group-hover:text-[#6366f1] transition-colors">{item.title}</p>
                    <p className="text-[11px] text-[#6b7280]">{item.year} · ★ {item.rating}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
