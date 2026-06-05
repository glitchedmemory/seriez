import type { TmdbResult } from "@/lib/tmdb";

export function HeroCard({ item, nextItem, region }: { item: TmdbResult; nextItem?: TmdbResult; region: string }) {
  return (
    <div className="px-0 pt-0 pb-2">
      {/* Main Hero */}
      <a
        href={`/title/${item.id}?type=${item.type}`}
        className="relative block rounded-none md:rounded-2xl overflow-hidden min-h-[280px] md:min-h-[340px] group cursor-pointer"
      >
        {/* Backdrop background */}
        {item.backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.backdrop}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            loading="eager"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#25253a] to-[#312e81]" />
        )}

        {/* Dark overlay gradient - left side darker for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f1a]/95 via-[#0f0f1a]/60 to-[#0f0f1a]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a]/90 via-transparent to-transparent" />

        {/* Top badges */}
        <div className="absolute top-4 left-4">
          <span className="px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-semibold">
            TRENDING NOW
          </span>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
          {/* Rating */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[#f59e0b] text-sm">★ {item.rating}</span>
            <span className="text-[#9ca3af] text-xs">
              {item.year} · {item.type === "movie" ? "Movie" : item.type === "anime" ? "Anime" : "TV"}
            </span>
            {item.genres.slice(0, 3).map((g) => (
              <span key={g} className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/80">
                {g}
              </span>
            ))}
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-2">
            {item.title}
          </h2>

          {/* Synopsis */}
          {item.overview && (
            <p className="text-sm text-white/70 leading-relaxed mb-4 max-w-lg line-clamp-2">
              {item.overview}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <span className="px-5 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-200 transition-colors inline-flex items-center gap-1.5">
              ▶ Watch Now
            </span>
            <span className="px-3 py-2 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors inline-flex items-center gap-1.5">
              +
            </span>
          </div>
        </div>
      </a>

      {/* Tonight's Pick / Next recommendation bar */}
      {nextItem && (
        <a
          href={`/title/${nextItem.id}?type=${nextItem.type}`}
          className="mt-3 mx-4 md:mx-0 flex items-center gap-3 bg-[#1a1a2e] hover:bg-[#25253a] rounded-xl p-2.5 transition-colors cursor-pointer"
        >
          {/* Poster thumbnail */}
          <div className="flex-shrink-0 w-12 h-[72px] rounded-lg overflow-hidden bg-[#0f0f1a]">
            {nextItem.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={nextItem.poster}
                alt={nextItem.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20 text-xs font-bold">
                {nextItem.title.slice(0, 2)}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#6366f1] uppercase tracking-wide font-medium">
              Tonight&apos;s Pick · {region}
            </p>
            <p className="text-sm font-semibold text-white truncate">
              {nextItem.title}
            </p>
            <p className="text-xs text-[#9ca3af]">
              {nextItem.type === "movie" ? "Movie" : nextItem.type === "anime" ? "Anime" : "TV"} · {nextItem.year} · ★ {nextItem.rating}
            </p>
          </div>

          {/* Arrow */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#6b7280] flex-shrink-0">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </a>
      )}
    </div>
  );
}