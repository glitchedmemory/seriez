"use client";

import type { PersonDetail } from "@/lib/tmdb";
import PosterImage from "@/components/PosterImage";

function CreditCard({ item, type }: { item: { id: number; title: string; character: string; year: number; poster: string | null; rating: number }; type: "movie" | "tv" }) {
  return (
    <a
      href={`/title/${item.id}?type=${type}`}
      className="flex items-center gap-3 bg-bg-card rounded-xl p-3 hover:bg-bg-surface transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-[60px] rounded-lg overflow-hidden bg-bg-primary relative">
        <PosterImage
          src={item.poster}
          alt={item.title}
          fill
          className="rounded-lg"
          sizes="40px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.title}</p>
        <p className="text-xs text-text-secondary">{item.year}</p>
        <p className="text-[11px] text-accent-light truncate">{item.character}</p>
      </div>
      <div className="text-xs text-gold">★ {item.rating}</div>
    </a>
  );
}

export default function PersonClient({ person }: { person: PersonDetail }) {
  return (
    <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 pt-8">
        {/* Photo */}
        <div className="flex-shrink-0 w-32 h-32 md:w-48 md:h-48 mx-auto md:mx-0">
          <div className="w-full h-full rounded-2xl overflow-hidden bg-bg-card relative">
            <PosterImage
              src={person.photo}
              alt={person.name}
              fill
              className="rounded-2xl"
              sizes="(max-width: 768px) 128px, 192px"
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {person.name}
          </h1>
          <p className="text-sm text-accent mt-1">{person.knownFor}</p>

          {person.birthday && (
            <p className="text-xs text-text-secondary mt-2">
              Born: {person.birthday}
              {person.birthplace ? ` · ${person.birthplace}` : ""}
            </p>
          )}
          {person.deathday && (
            <p className="text-xs text-text-secondary">
              Died: {person.deathday}
            </p>
          )}
        </div>
      </div>

      {/* Biography */}
      {person.biography && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-white mb-2">Biography</h2>
          <p className="text-sm text-[#d1d5db] leading-relaxed">{person.biography}</p>
        </section>
      )}

      {/* Movies */}
      {person.movieCredits.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            🎬 Movies ({person.movieCredits.length})
          </h2>
          <div className="space-y-2">
            {person.movieCredits.map((m, i) => (
              <CreditCard key={`movie-${m.id}-${i}`} item={m} type="movie" />
            ))}
          </div>
        </section>
      )}

      {/* TV Shows */}
      {person.tvCredits.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            📺 TV Shows ({person.tvCredits.length})
          </h2>
          <div className="space-y-2">
            {person.tvCredits.map((t, i) => (
              <CreditCard key={`tv-${t.id}-${i}`} item={t} type="tv" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}