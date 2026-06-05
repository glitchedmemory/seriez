"use client";

import { useState, useMemo, useEffect } from "react";
import { PosterCard, HorizontalScroll } from "@/components/PosterCard";
import { HeroCard } from "@/components/HeroCard";
import { GenreChips } from "@/components/GenreChips";
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

function ResponsiveGrid({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="md:hidden flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar">{children}</div>
      <div className="hidden md:grid grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 px-4 md:px-0">{children}</div>
    </>
  );
}

function CardWrapper({ item, showReason, showCountdown }: { item: TmdbResult; showReason?: boolean; showCountdown?: boolean }) {
  return (
    <a href={`/title/${item.id}?type=${item.type}`} className="flex-shrink-0 w-32 md:w-auto block">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#1a1a2e] group md:hover:scale-105 transition-transform">
        {item.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.poster}
            alt={item.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white/20">{item.title.slice(0, 2)}</span>
          </div>
        )}
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
      {showReason && (
        <p className="text-[10px] text-[#6366f1] mt-0.5 line-clamp-1">
          {item.genres?.slice(0, 2).join(" · ")}
        </p>
      )}
    </a>
  );
}

interface Props {
  trending: TmdbResult[];
  upcoming: TmdbResult[];
  boxOffice: TmdbResult[];
  region: string;
}

export default function HomeClient({ trending, upcoming, boxOffice, region }: Props) {
  const [activeGenre, setActiveGenre] = useState("All");

  // "For You" personalized recommendations
  const [forYouItems, setForYouItems] = useState<TmdbResult[] | null>(null);
  const [forYouGenres, setForYouGenres] = useState<string[]>([]);
  const [forYouReason, setForYouReason] = useState("");

  useEffect(() => {
    const username = localStorage.getItem("reelist_username");
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

  // Random trending pick — changes on page refresh
  const heroPick = useMemo(() => {
    if (trending.length === 0) return 0;
    return Math.floor(Math.random() * trending.length);
  }, []);
  const hero = trending[heroPick];
  const nextHero = trending.filter((_, i) => i !== heroPick).slice(0, 1)[0];

  return (
    <div className="max-w-lg md:max-w-none mx-auto min-h-screen">
      <header className="md:hidden sticky top-0 z-40 bg-[#0f0f1a]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[#1a1a2e]">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">Reelist</h1>
        <a href="/search" className="text-[#9ca3af] hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </a>
      </header>

      <div className="md:flex md:gap-6 md:px-4 md:pt-6">
        <div className="md:flex-1 md:min-w-0 md:space-y-8">
          {hero && <HeroCard item={hero} nextItem={nextHero} region={region} />}

          <section>
            <div className="px-4 md:px-0 mb-3">
              <h2 className="text-lg font-semibold">⏳ Coming Soon</h2>
              <p className="text-xs text-[#9ca3af]">Upcoming releases</p>
            </div>
            <ResponsiveGrid>
              {upcoming.map((item) => <CardWrapper key={item.id} item={item} showCountdown />)}
            </ResponsiveGrid>
          </section>

          <GenreChips selected={activeGenre} onSelect={setActiveGenre} />

          <section>
            <div className="px-4 md:px-0 mb-3">
              <h2 className="text-lg font-semibold">🎯 For You</h2>
              <p className="text-xs text-[#9ca3af]">
                {forYouItems === null
                  ? "Loading..."
                  : forYouGenres.length > 0
                  ? `Because you like ${forYouGenres.join(", ")}`
                  : forYouReason || "Based on your ratings"}
              </p>
            </div>
            <ResponsiveGrid>
              {(forYouItems && forYouItems.length > 0
                ? forYouItems
                : trending
              ).map((item) => (
                <CardWrapper key={item.id} item={item} showReason />
              ))}
            </ResponsiveGrid>
          </section>

          <section>
            <div className="px-4 md:px-0 mb-3">
              <h2 className="text-lg font-semibold">🔥 Trending This Week</h2>
              <p className="text-xs text-[#9ca3af]">Most popular worldwide</p>
            </div>
            <ResponsiveGrid>
              {trending.map((item) => <CardWrapper key={item.id} item={item} />)}
            </ResponsiveGrid>
          </section>

          <section>
            <div className="px-4 md:px-0 mb-3">
              <h2 className="text-lg font-semibold">🎬 Box Office · {region}</h2>
              <p className="text-xs text-[#9ca3af]">Now playing in theaters</p>
            </div>
            <div className="px-4 md:px-0 grid md:grid-cols-2 lg:grid-cols-3 gap-2">
              {boxOffice.map((movie, i) => (
                <a
                  key={movie.id}
                  href={`/title/${movie.id}?type=${movie.type}`}
                  className="flex items-center gap-3 bg-[#1a1a2e] rounded-xl p-3 hover:bg-[#25253a] transition-colors cursor-pointer"
                >
                  <span className={`text-lg font-bold w-6 text-center ${
                    i === 0 ? "text-[#f59e0b]" : i === 1 ? "text-[#9ca3af]" : "text-amber-700"
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{movie.title}</h3>
                    <p className="text-xs text-[#9ca3af]">{movie.year} · ⭐ {movie.rating}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <div className="h-4" />
        </div>

        <aside className="hidden md:block w-72 lg:w-80 flex-shrink-0 space-y-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search movies, TV, anime..."
              className="w-full bg-[#1a1a2e] text-white text-sm rounded-xl px-4 py-2.5 pl-10 outline-none border border-transparent focus:border-[#6366f1] transition-colors placeholder:text-[#6b7280]"
            />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#6b7280] absolute left-3.5 top-3">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">📺 Streaming Top 10</h3>
            <p className="text-xs text-[#6b7280]">Coming with real data soon</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">🔥 Trending</h3>
            <div className="space-y-2">
              {trending.slice(0, 5).map((item, i) => (
                <a
                  key={item.id}
                  href={`/title/${item.id}?type=${item.type}`}
                  className="flex items-center gap-3 bg-[#1a1a2e] rounded-xl p-2.5 hover:bg-[#25253a] transition-colors cursor-pointer"
                >
                  <span className={`text-sm font-bold w-5 text-center ${i === 0 ? "text-[#f59e0b]" : "text-[#6b7280]"}`}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{item.title}</p>
                    <p className="text-xs text-[#9ca3af]">{item.year} · ⭐ {item.rating}</p>
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
