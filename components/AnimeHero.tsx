import type { AnimeDetail } from "@/lib/anilist";
import PosterImage from "@/components/PosterImage";

function seasonLabel(detail: AnimeDetail): string | null {
  if (!detail.season || !detail.year) return null;
  return `${detail.season} ${detail.year}`;
}

export default function AnimeHero({ detail, children }: { detail: AnimeDetail; children?: React.ReactNode }) {
  const label = seasonLabel(detail);
  const hasBackdrop = !!(detail.backdrop || detail.poster);

  return (
    <>
      {/* Backdrop */}
      {hasBackdrop && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden">
          <PosterImage src={detail.backdrop || detail.poster} alt="" fill priority unoptimized className={!detail.backdrop ? "blur-2xl scale-125 opacity-50" : ""} />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-[#0f0f1a]/60 to-transparent" />
        </div>
      )}

      <div className={`relative px-4 md:px-0 z-10 ${hasBackdrop ? '-mt-20 md:-mt-32' : ''}`}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="flex-shrink-0 w-36 md:w-48 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-card shadow-2xl relative">
              <PosterImage src={detail.poster} alt={detail.title} fill className="rounded-xl" sizes="(max-width: 768px) 144px, 192px" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-tight">
              {detail.title}
            </h1>
            {detail.titleRomaji && detail.titleRomaji !== detail.title && (
              <p className="text-sm text-text-secondary mt-0.5">{detail.titleRomaji}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3 text-xs text-text-secondary">
              {label && (
                <span className="bg-bg-card px-2 py-0.5 rounded-full">{label}</span>
              )}
              <span className="bg-bg-card px-2 py-0.5 rounded-full uppercase">{detail.format}</span>
              {detail.episodes > 0 && (
                <span className="bg-bg-card px-2 py-0.5 rounded-full">{detail.episodes} Ep</span>
              )}
              {detail.duration > 0 && (
                <span className="bg-bg-card px-2 py-0.5 rounded-full">{detail.duration}m</span>
              )}
              <span className="bg-bg-card px-2 py-0.5 rounded-full">{detail.status}</span>
              <span className="bg-accent/15 text-accent px-2 py-0.5 rounded-full font-semibold">
                Seriez Score: {detail.rating}/10
              </span>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center md:justify-start">
              {detail.genres.map((g) => (
                <span key={g} className="text-[11px] px-2.5 py-1 rounded-full bg-bg-card text-accent-light border border-accent/30">
                  {g}
                </span>
              ))}
            </div>

            {/* Studio + Staff */}
            {children}
            <div className="text-xs text-text-secondary mt-3 space-y-1 text-center md:text-left">
              {detail.studios.length > 0 && (
                <div>
                  <span className="text-text-primary font-medium">Studio: </span>
                  {detail.studios.join(", ")}
                </div>
              )}
              {detail.staff.length > 0 && (
                <div className="text-[11px] mt-0.5">
                  <span className="text-text-primary font-medium">Staff: </span>
                  {detail.staff.slice(0, 6).map((s, i) => (
                    <span key={s.id}>
                      {s.name} ({s.role}){i < Math.min(detail.staff.length, 6) - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
