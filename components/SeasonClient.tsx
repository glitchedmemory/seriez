"use client";

import { useState, useRef } from "react";
import { ReviewSection } from "@/components/ReviewSection";

interface SeasonData {
  id: number;
  title: string;
  tagline: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  voteCount: number;
  year: number;
  genres: string[];
  status: string;
  type: "tv";
  totalSeasons: number;
  totalEpisodes: number;
  createdBy?: string[];
  networks?: string[];
  lastAirDate?: string;
  cast: { id: number; name: string; character: string; photo: string | null }[];
  trailers: { key: string; name: string; site: string; type: string }[];
  similar: { id: number; title: string; poster: string | null; rating: number; year: number; type: "movie" | "tv" }[];
  seasonNumber: number;
  seasonName: string;
  seasonOverview: string;
  seasonPoster: string | null;
  seasonAirDate: string;
  episodes: {
    number: number;
    name: string;
    overview: string;
    still: string | null;
    rating: number;
    voteCount: number;
    airDate: string;
    runtime: number;
  }[];
}

function formatRuntime(minutes: number) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SeasonClient({ data }: { data: SeasonData }) {
  const [showAllCast, setShowAllCast] = useState(false);
  const visibleCast = showAllCast ? data.cast : data.cast.slice(0, 6);

  return (
    <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
      {/* Backdrop */}
      {data.backdropPath && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.backdropPath.replace("w342", "w780")}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-[#0f0f1a]/60 to-transparent" />
        </div>
      )}

      <div className="relative px-4 md:px-0 -mt-20 md:-mt-32 z-10">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="flex-shrink-0 w-36 md:w-48 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#1a1a2e] shadow-2xl">
              {data.seasonPoster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.seasonPoster}
                  alt={data.seasonName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-4xl font-bold">
                  S{data.seasonNumber}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
              {data.title}
            </h1>
            <p className="text-lg text-[#9ca3af] mt-0.5">{data.seasonName}</p>
            {data.tagline && (
              <p className="text-sm text-[#9ca3af] italic mt-1">
                &ldquo;{data.tagline}&rdquo;
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3 text-xs text-[#9ca3af]">
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">{data.year}</span>
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full uppercase">tv</span>
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">{data.status}</span>
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
                {data.totalSeasons} Season{data.totalSeasons > 1 ? "s" : ""}
                {data.totalEpisodes ? ` · ${data.totalEpisodes} Ep` : ""}
              </span>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center md:justify-start">
              {data.genres.map((g) => (
                <span
                  key={g}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-[#1a1a2e] text-[#c4b5fd] border border-[#6366f1]/30"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Rating */}
            <div className="mt-4 text-center md:text-left">
              <div className="text-3xl font-bold text-[#f59e0b]">
                ★ {data.rating}
              </div>
              <div className="text-[10px] text-[#6b7280]">
                {data.voteCount.toLocaleString()} votes
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4 justify-center md:justify-start">
              <button className="px-4 py-1.5 bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium rounded-lg transition-colors">
                + Add to List
              </button>
              <button className="px-4 py-1.5 bg-[#1a1a2e] hover:bg-[#25253a] text-white text-sm font-medium rounded-lg border border-[#2d2d4a] transition-colors">
                ★ Rate
              </button>
            </div>

            {/* Season selector */}
            {data.totalSeasons > 0 && (
              <div className="mt-3">
                <p className="text-[10px] text-[#6b7280] mb-1.5 uppercase tracking-wide">
                  Seasons
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                  {Array.from({ length: data.totalSeasons }, (_, i) => i + 1).map((s) => (
                    <a
                      key={s}
                      href={`/title/${data.id}/season/${s}`}
                      className={`px-3 py-1 text-xs rounded-full transition-all ${
                        s === data.seasonNumber
                          ? "bg-[#6366f1] text-white"
                          : "bg-[#1a1a2e] hover:bg-[#25253a] text-[#9ca3af] border border-[#2d2d4a]"
                      }`}
                    >
                      S{s}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Extra info */}
            <div className="mt-3 text-xs text-[#6b7280] space-y-0.5">
              {data.createdBy && (
                <p>
                  Created by:{" "}
                  <span className="text-[#9ca3af]">{data.createdBy.join(", ")}</span>
                </p>
              )}
              {data.networks && (
                <p>
                  Network:{" "}
                  <span className="text-[#9ca3af]">{data.networks.join(", ")}</span>
                </p>
              )}
              {data.seasonAirDate && (
                <p>
                  Season aired:{" "}
                  <span className="text-[#9ca3af]">{data.seasonAirDate}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Overview */}
        {data.overview && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-2">Overview</h2>
            <p className="text-sm text-[#d1d5db] leading-relaxed">{data.overview}</p>
          </section>
        )}

        {/* Season description */}
        {data.seasonOverview && data.seasonOverview !== data.overview && (
          <section className="mt-4">
            <h2 className="text-md font-semibold text-[#9ca3af] mb-1">About This Season</h2>
            <p className="text-sm text-[#d1d5db] leading-relaxed">{data.seasonOverview}</p>
          </section>
        )}

        {/* Episodes */}
        {data.episodes.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3">
              Episodes · {data.episodes.length}
            </h2>
            <div className="space-y-3">
              {data.episodes.map((ep) => (
                <div
                  key={ep.number}
                  className="flex gap-3 bg-[#1a1a2e] rounded-xl p-3 hover:bg-[#25253a] transition-colors"
                >
                  {ep.still ? (
                    <div className="flex-shrink-0 w-28 md:w-40 aspect-video rounded-lg overflow-hidden bg-[#0f0f1a]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ep.still}
                        alt={ep.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-28 md:w-40 aspect-video rounded-lg overflow-hidden bg-[#0f0f1a] flex items-center justify-center">
                      <span className="text-2xl text-[#25253a] font-bold">{ep.number}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-[#6366f1]">{ep.number}</span>
                      <h3 className="text-sm font-medium text-white truncate">{ep.name}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[#6b7280]">
                      {ep.runtime > 0 && <span>{formatRuntime(ep.runtime)}</span>}
                      {ep.airDate && <span>{ep.airDate}</span>}
                      {ep.rating > 0 && <span className="text-[#f59e0b]">★ {ep.rating}</span>}
                    </div>
                    {ep.overview && (
                      <p className="mt-1 text-xs text-[#9ca3af] leading-relaxed line-clamp-2">
                        {ep.overview}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trailers */}
        {data.trailers.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3">🎬 Trailers</h2>
            <div className="space-y-3">
              {data.trailers.map((v) => (
                <div key={v.key} className="aspect-video rounded-xl overflow-hidden bg-[#1a1a2e]">
                  <iframe
                    src={`https://www.youtube.com/embed/${v.key}`}
                    title={v.name}
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cast */}
        {data.cast.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3">Cast</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {visibleCast.map((c) => (
                <a
                  key={c.name}
                  href={`/person/${c.id}`}
                  className="bg-[#1a1a2e] rounded-xl p-2 text-center hover:bg-[#25253a] transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-[#25253a] mb-2">
                    {c.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30 text-lg">
                        {c.name[0]}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-white truncate">{c.name}</p>
                  <p className="text-[10px] text-[#6b7280] truncate">{c.character}</p>
                </a>
              ))}
            </div>
            {data.cast.length > 6 && (
              <button
                onClick={() => setShowAllCast(!showAllCast)}
                className="mt-3 text-xs text-[#6366f1] hover:underline mx-auto block"
              >
                {showAllCast ? "Show less" : `Show all ${data.cast.length} cast members`}
              </button>
            )}
          </section>
        )}

        {/* Similar Titles */}
        {data.similar.length > 0 && (
          <SimilarSection items={data.similar} />
        )}

        {/* Reviews for this series (shared across all seasons) */}
        <section className="mt-6">
          <ReviewSection tmdbId={data.id} mediaType="tv" />
        </section>
      </div>
    </div>
  );
}

type SimilarItem = { id: number; title: string; poster: string | null; rating: number; year: number; type: "movie" | "tv" };

function SimilarSection({ items }: { items: SimilarItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Similar Titles</h2>
        <div className="hidden md:flex gap-1">
          <button onClick={() => scroll("left")} className="w-8 h-8 rounded-full bg-[#1a1a2e] hover:bg-[#25253a] flex items-center justify-center text-white text-sm transition-colors">←</button>
          <button onClick={() => scroll("right")} className="w-8 h-8 rounded-full bg-[#1a1a2e] hover:bg-[#25253a] flex items-center justify-center text-white text-sm transition-colors">→</button>
        </div>
      </div>
      <div ref={ref} className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar scroll-smooth">
        {items.map((item) => (
          <a key={item.id} href={`/title/${item.id}?type=${item.type}`} className="flex-shrink-0 w-28 group">
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a2e] group-hover:scale-105 transition-transform">
              {item.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 text-lg font-bold">{item.title.slice(0, 2)}</div>
              )}
            </div>
            <p className="text-[11px] text-white mt-1 line-clamp-1">{item.title}</p>
            <p className="text-[10px] text-[#6b7280]">★ {item.rating}</p>
          </a>
        ))}
      </div>
    </section>
  );
}