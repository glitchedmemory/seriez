import type { TmdbDetail } from "@/lib/tmdb";
import Image from "next/image";
import ShareButton from "@/components/ShareButton";

export default function MovieHero({ detail, children, shareUrl }: { detail: TmdbDetail; children?: React.ReactNode; shareUrl?: string }) {
  const hasBackdrop = !!(detail.backdrop || detail.poster);

  return (
    <>
      {hasBackdrop && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden">
          <Image
            src={(detail.backdrop || detail.poster)!.replace("w342", "w1280")}
            alt=""
            fill
            priority
            unoptimized
            className={detail.backdrop ? "object-cover" : "object-cover blur-2xl scale-125 opacity-50"}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-[#0f0f1a]/60 to-transparent" />
          {shareUrl && <ShareButton title={detail.title} url={shareUrl} variant="backdrop" />}
        </div>
      )}

      <div className={`relative px-4 md:px-0 z-10 ${hasBackdrop ? '-mt-20 md:-mt-32' : ''}`}>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-shrink-0 w-36 md:w-48 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-bg-card shadow-2xl relative">
              <Image
                src={detail.poster || ""}
                alt={detail.title}
                fill
                priority
                className="object-cover rounded-xl"
                sizes="(max-width: 768px) 144px, 192px"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-tight">
              {detail.title}
            </h1>
            {detail.tagline && (
              <p className="text-sm text-text-secondary italic mt-1">
                &ldquo;{detail.tagline}&rdquo;
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3 text-xs text-text-secondary">
              <span className="bg-bg-card px-2 py-0.5 rounded-full">
                {detail.year}
              </span>
              <span className="bg-bg-card px-2 py-0.5 rounded-full uppercase">
                {detail.type}
              </span>
              {detail.runtime > 0 && (
                <span className="bg-bg-card px-2 py-0.5 rounded-full">
                  {formatRuntime(detail.runtime)}
                </span>
              )}
              <span className="bg-bg-card px-2 py-0.5 rounded-full">
                {detail.status}
              </span>
              <span className="bg-accent/15 text-accent px-2 py-0.5 rounded-full font-semibold">
                Seriez Score: {detail.rating}/10
              </span>
              {detail.countries?.length > 0 && (
                <span className="flex items-center gap-1">
                  {detail.countries.map((c) => (
                    <span
                      key={c.code}
                      title={c.name}
                      className="bg-bg-card px-1.5 py-0.5 rounded-full text-base leading-none"
                    >
                      {countryFlag(c.code)}
                    </span>
                  ))}
                </span>
              )}
              {detail.type === "tv" && detail.seasons && (
                <span className="bg-bg-card px-2 py-0.5 rounded-full">
                  {detail.seasons} Season{detail.seasons > 1 ? "s" : ""}
                  {detail.episodes ? ` · ${detail.episodes} Ep` : ""}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-3 justify-center md:justify-start">
              {detail.genres.map((g) => (
                <span
                  key={g}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-bg-card text-accent-light border border-accent/30"
                >
                  {g}
                </span>
              ))}
            </div>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

function formatRuntime(minutes: number) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Convert ISO 3166-1 alpha-2 code (e.g. "US") to regional indicator emoji flag (🇺🇸)
function countryFlag(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}
