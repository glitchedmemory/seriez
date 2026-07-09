import PosterImage from "@/components/PosterImage";

interface SeasonData {
  id: number;
  title: string;
  tagline: string;
  posterPath: string | null;
  backdropPath: string | null;
  youtubeBackdrop?: string | null;
  anilistBanner?: string | null;
  rating: number;
  year: number;
  genres: string[];
  status: string;
  totalSeasons: number;
  totalEpisodes: number;
  createdBy?: string[];
  networks?: string[];
  seasonAirDate: string;
  seasonName: string;
  seasonPoster: string | null;
  daysUntil?: number | null;
}

export default function SeasonHero({ data }: { data: SeasonData }) {
  const hasBackdrop = !!(data.backdropPath || data.youtubeBackdrop || data.anilistBanner || data.posterPath);

  return (
    <>
      {/* Backdrop */}
      {hasBackdrop && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden">
          <PosterImage
            src={data.backdropPath?.replace("w342", "w1280") || data.youtubeBackdrop || data.anilistBanner || data.posterPath?.replace("w342", "w1280") || ""}
            alt=""
            fill
            priority
            unoptimized
            className={(!data.backdropPath && !data.youtubeBackdrop && !data.anilistBanner) ? "blur-2xl scale-125 opacity-50" : ""}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-[#0f0f1a]/60 to-transparent" />
        </div>
      )}

      <div className={`relative px-4 md:px-0 z-10 ${hasBackdrop ? '-mt-20 md:-mt-32' : ''}`}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="flex-shrink-0 w-36 md:w-48 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-card shadow-2xl relative">
              <PosterImage
                src={data.seasonPoster}
                alt={data.seasonName}
                fill
                className="rounded-xl"
                sizes="(max-width: 768px) 144px, 192px"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-tight">
              {data.title}
            </h1>
            <p className="text-lg text-text-secondary mt-0.5">{data.seasonName}</p>
            {data.tagline && (
              <p className="text-sm text-text-secondary italic mt-1">
                &ldquo;{data.tagline}&rdquo;
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3 text-xs text-text-secondary">
              <span className="bg-bg-card px-2 py-0.5 rounded-full">{data.year}</span>
              <span className="bg-bg-card px-2 py-0.5 rounded-full uppercase">tv</span>
              <span className="bg-bg-card px-2 py-0.5 rounded-full">{data.status}</span>
              <span className="bg-accent/15 text-accent px-2 py-0.5 rounded-full font-semibold">
                Seriez Score: {data.rating}/10
              </span>
              <span className="bg-bg-card px-2 py-0.5 rounded-full">
                {data.totalSeasons} Season{data.totalSeasons > 1 ? "s" : ""}
                {data.totalEpisodes ? ` · ${data.totalEpisodes} Ep` : ""}
              </span>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center md:justify-start">
              {data.genres.map((g) => (
                <span
                  key={g}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-bg-card text-accent-light border border-accent/30"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Studios */}
            <div className="mt-3 text-xs text-text-secondary space-y-0.5">
              {data.createdBy && (
                <p>
                  Created by:{" "}
                  <span className="text-text-secondary">{data.createdBy.join(", ")}</span>
                </p>
              )}
              {data.networks && (
                <p>
                  Network:{" "}
                  <span className="text-text-secondary">{data.networks.join(", ")}</span>
                </p>
              )}
              {data.seasonAirDate && (
                <p>
                  Season aired:{" "}
                  <span className="text-text-secondary">{data.seasonAirDate}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
