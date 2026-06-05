"use client";

import { useState, useRef } from "react";
import type { TmdbDetail } from "@/lib/tmdb";
import { ReviewSection } from "@/components/ReviewSection";

function formatCurrency(n: number) {
  if (n === 0) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatRuntime(minutes: number) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DetailClient({ detail }: { detail: TmdbDetail }) {
  const [showAllCast, setShowAllCast] = useState(false);
  const visibleCast = showAllCast ? detail.cast : detail.cast.slice(0, 6);

  return (
    <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
      {/* Backdrop */}
      {detail.backdrop && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={detail.backdrop.replace("w342", "w780")}
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
              {detail.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.poster}
                  alt={detail.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-4xl font-bold">
                  {detail.title.slice(0, 2)}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
              {detail.title}
            </h1>
            {detail.tagline && (
              <p className="text-sm text-[#9ca3af] italic mt-1">
                &ldquo;{detail.tagline}&rdquo;
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3 text-xs text-[#9ca3af]">
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
                {detail.year}
              </span>
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full uppercase">
                {detail.type}
              </span>
              {detail.runtime > 0 && (
                <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
                  {formatRuntime(detail.runtime)}
                </span>
              )}
              <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
                {detail.status}
              </span>
              {detail.type === "tv" && detail.seasons && (
                <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
                  {detail.seasons} Season{detail.seasons > 1 ? "s" : ""}
                  {detail.episodes ? ` · ${detail.episodes} Ep` : ""}
                </span>
              )}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center md:justify-start">
              {detail.genres.map((g) => (
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
                ★ {detail.rating}
              </div>
              <div className="text-[10px] text-[#6b7280]">
                {detail.voteCount.toLocaleString()} votes
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

            {/* Season selector — TV only */}
            {detail.type === "tv" && detail.seasons && detail.seasons > 0 && (
              <div className="mt-3">
                <p className="text-[10px] text-[#6b7280] mb-1.5 uppercase tracking-wide">
                  Seasons · Rate each separately
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                  {Array.from({ length: detail.seasons }, (_, i) => i + 1).map(
                    (s) => (
                      <a
                        key={s}
                        href={`/title/${detail.id}/season/${s}`}
                        className="px-3 py-1 text-xs rounded-full bg-[#1a1a2e] hover:bg-[#6366f1] text-[#9ca3af] hover:text-white border border-[#2d2d4a] hover:border-[#6366f1] transition-all"
                      >
                        S{s}
                      </a>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Extra info */}
            <div className="mt-3 text-xs text-[#6b7280] space-y-0.5">
              {detail.type === "movie" && detail.director && (
                <p>
                  Director:{" "}
                  <span className="text-[#9ca3af]">{detail.director}</span>
                </p>
              )}
              {detail.type === "tv" && detail.createdBy && (
                <p>
                  Created by:{" "}
                  <span className="text-[#9ca3af]">
                    {detail.createdBy.join(", ")}
                  </span>
                </p>
              )}
              {detail.type === "tv" && detail.networks && (
                <p>
                  Network:{" "}
                  <span className="text-[#9ca3af]">
                    {detail.networks.join(", ")}
                  </span>
                </p>
              )}
              {detail.type === "movie" && detail.budget ? (
                <p>
                  Budget:{" "}
                  <span className="text-[#9ca3af]">
                    {formatCurrency(detail.budget)}
                  </span>
                  {detail.revenue ? (
                    <>
                      {" "}
                      · Revenue:{" "}
                      <span className="text-[#9ca3af]">
                        {formatCurrency(detail.revenue)}
                      </span>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Overview */}
        {detail.overview && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-2">Overview</h2>
            <p className="text-sm text-[#d1d5db] leading-relaxed">
              {detail.overview}
            </p>
          </section>
        )}

        {/* Trailers */}
        {detail.videos.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3">
              🎬 Trailers
            </h2>
            <div className="space-y-3">
              {detail.videos.map((v) => (
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
        {detail.cast.length > 0 && (
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
                      <img
                        src={c.photo}
                        alt={c.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30 text-lg">
                        {c.name[0]}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-white truncate">
                    {c.name}
                  </p>
                  <p className="text-[10px] text-[#6b7280] truncate">
                    {c.character}
                  </p>
                </a>
              ))}
            </div>
            {detail.cast.length > 6 && (
              <button
                onClick={() => setShowAllCast(!showAllCast)}
                className="mt-3 text-xs text-[#6366f1] hover:underline mx-auto block"
              >
                {showAllCast ? "Show less" : `Show all ${detail.cast.length} cast members`}
              </button>
            )}
          </section>
        )}

        {/* Similar */}
        {detail.similar.length > 0 && (
          <SimilarSection items={detail.similar} />
        )}

        {/* Reviews */}
        <section className="mt-6">
          <ReviewSection tmdbId={detail.id} mediaType={detail.type} />
        </section>
      </div>
    </div>
  );
}

function SimilarSection({ items }: { items: TmdbDetail["similar"] }) {
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
          <button
            onClick={() => scroll("left")}
            className="w-8 h-8 rounded-full bg-[#1a1a2e] hover:bg-[#25253a] flex items-center justify-center text-white text-sm transition-colors"
          >
            ←
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-8 h-8 rounded-full bg-[#1a1a2e] hover:bg-[#25253a] flex items-center justify-center text-white text-sm transition-colors"
          >
            →
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar scroll-smooth"
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={`/title/${item.id}?type=${item.type}`}
            className="flex-shrink-0 w-28 group"
          >
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a2e] group-hover:scale-105 transition-transform">
              {item.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 text-lg font-bold">
                  {item.title.slice(0, 2)}
                </div>
              )}
            </div>
            <p className="text-[11px] text-white mt-1 line-clamp-1">
              {item.title}
            </p>
            <p className="text-[10px] text-[#6b7280]">
              ★ {item.rating}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
