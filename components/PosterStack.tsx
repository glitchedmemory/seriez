"use client";

import Image from "next/image";

export interface PosterData {
  tmdbId: number;
  title: string;
  posterPath: string | null;
}

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w500";

interface PosterStackProps {
  posters: PosterData[];
  day: number;
  count: number;
}

export default function PosterStack({ posters, day, count }: PosterStackProps) {
  // Single poster: full cell fill
  if (posters.length === 1) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-lg bg-[#0f0f1a]">
        {posters[0].posterPath ? (
          <Image
            src={`${TMDB_IMAGE}${posters[0].posterPath}`}
            alt={posters[0].title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 14vw, 80px"
            unoptimized
          />
        ) : (
          <FallbackPoster title={posters[0].title} />
        )}
        <span className="absolute bottom-0.5 right-1.5 text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] z-10">
          {day}
        </span>
      </div>
    );
  }

  // Multiple posters: stacked effect
  const displayPosters = posters.slice(0, 3);
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-[#0f0f1a]">
      {/* Background: first poster dimmed */}
      {posters[0].posterPath ? (
        <Image
          src={`${TMDB_IMAGE}${posters[0].posterPath}`}
          alt=""
          fill
          className="object-cover opacity-30"
          sizes="80px"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-purple-900" />
      )}

      {/* Stacked cards */}
      <div className="absolute inset-0 flex items-center justify-center">
        {displayPosters.map((p, i) => (
          <div
            key={i}
            className="absolute w-[68%] aspect-[2/3] rounded-md overflow-hidden shadow-xl shadow-black/60"
            style={{
              transform: `rotate(${(i - (displayPosters.length - 1) / 2) * 6}deg)`,
              zIndex: displayPosters.length - i,
            }}
          >
            {p.posterPath ? (
              <Image
                src={`${TMDB_IMAGE}${p.posterPath}`}
                alt={p.title}
                fill
                className="object-cover"
                sizes="56px"
                unoptimized
              />
            ) : (
              <FallbackPoster title={p.title} small />
            )}
          </div>
        ))}
      </div>

      {/* Count badge */}
      {count > 1 && (
        <span className="absolute top-1 right-1 bg-black/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-20">
          {count}
        </span>
      )}

      {/* Day number */}
      <span className="absolute bottom-0.5 right-1.5 text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] z-20">
        {day}
      </span>
    </div>
  );
}

function FallbackPoster({
  title,
  small,
}: {
  title: string;
  small?: boolean;
}) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center p-0.5">
      <span
        className={`text-white/60 font-semibold text-center leading-tight ${
          small ? "text-[8px]" : "text-[10px]"
        }`}
      >
        {title}
      </span>
    </div>
  );
}
