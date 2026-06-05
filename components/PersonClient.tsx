"use client";

import type { PersonDetail } from "@/lib/tmdb";

function CreditCard({ item, type }: { item: { id: number; title: string; character: string; year: number; poster: string | null; rating: number }; type: "movie" | "tv" }) {
  return (
    <a
      href={`/title/${item.id}?type=${type}`}
      className="flex items-center gap-3 bg-[#1a1a2e] rounded-xl p-3 hover:bg-[#25253a] transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-[60px] rounded-lg overflow-hidden bg-[#0f0f1a]">
        {item.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-xs font-bold">
            {item.title.slice(0, 2)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.title}</p>
        <p className="text-xs text-[#6b7280]">{item.year}</p>
        <p className="text-[11px] text-[#a855f7] truncate">{item.character}</p>
      </div>
      <div className="text-xs text-[#f59e0b]">★ {item.rating}</div>
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
          <div className="w-full h-full rounded-2xl overflow-hidden bg-[#1a1a2e]">
            {person.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.photo}
                alt={person.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 text-4xl font-bold">
                {person.name[0]}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {person.name}
          </h1>
          <p className="text-sm text-[#6366f1] mt-1">{person.knownFor}</p>

          {person.birthday && (
            <p className="text-xs text-[#9ca3af] mt-2">
              Born: {person.birthday}
              {person.birthplace ? ` · ${person.birthplace}` : ""}
            </p>
          )}
          {person.deathday && (
            <p className="text-xs text-[#9ca3af]">
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
            {person.movieCredits.map((m) => (
              <CreditCard key={`movie-${m.id}`} item={m} type="movie" />
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
            {person.tvCredits.map((t) => (
              <CreditCard key={`tv-${t.id}`} item={t} type="tv" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}