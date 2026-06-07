"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { GENRE_MAP, type TmdbResult } from "@/lib/tmdb";
import PosterImage from "@/components/PosterImage";

// ── Search dropdown item ──
type SearchItem = {
  id: number;
  title: string;
  year: number | string;
  type: string;
  poster: string | null;
  rating: number;
};

// ── Watched item ──
type Watched = SearchItem & { userRating: number };

// ── Curation result ──
type Curation = {
  item: TmdbResult;
  reason: string;
};

// ── Genre chip ──
function GenreChip({
  name,
  selected,
  onClick,
}: {
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
        selected
          ? "bg-[#6366f1] text-white scale-105"
          : "bg-[#1a1a2e] text-[#9ca3af] hover:bg-[#25253a] hover:text-white"
      }`}
    >
      {name}
    </button>
  );
}

// ── Star selector ──
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          className="text-lg transition-colors"
          style={{ color: (hover || value) >= star ? "#f59e0b" : "#374151" }}
        >
          ★
        </button>
      ))}
      {value > 0 && <span className="ml-1 text-xs text-[#9ca3af]">{value}/5</span>}
    </div>
  );
}

// ── Steps ──
const STEP = { GENRES: 0, WATCHED: 1, CURATION: 2 } as const;

export default function OnboardingPage() {
  const [step, setStep] = useState<number>(STEP.GENRES);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);

  // Step 2: search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [watched, setWatched] = useState<(Watched | null)[]>([null, null, null]);
  const debounce = useRef<NodeJS.Timeout | null>(null);

  // Step 3: curation
  const [curation, setCuration] = useState<Curation | null>(null);
  const [loadingCuration, setLoadingCuration] = useState(false);
  const [error, setError] = useState("");

  // ── Search handler ──
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => doSearch(query), 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, doSearch]);

  // ── Add to watched ──
  const addWatched = (item: SearchItem) => {
    const idx = watched.findIndex((w) => w === null);
    if (idx === -1) return;
    const next = [...watched];
    next[idx] = { ...item, userRating: 0 };
    setWatched(next);
    setQuery("");
    setResults([]);
  };

  const setRating = (idx: number, rating: number) => {
    const next = [...watched];
    const w = next[idx];
    if (!w) return;
    next[idx] = { ...w, userRating: rating };
    setWatched(next);
  };

  const removeWatched = (idx: number) => {
    const next = [...watched];
    next[idx] = null;
    setWatched(next);
  };

  // ── Run curation ──
  const runCuration = async () => {
    setLoadingCuration(true);
    setError("");
    try {
      const genreParam = selectedGenres.join(",");
      const excludeParam = watched
        .filter((w): w is Watched => w !== null)
        .map((w) => w.id)
        .join(",");
      const res = await fetch(
        `/api/onboarding-curation?genres=${genreParam}&exclude=${excludeParam}`
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Could not generate recommendation");
        setLoadingCuration(false);
        return;
      }
      const data = await res.json();
      setCuration(data);
      setStep(STEP.CURATION);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingCuration(false);
    }
  };

  const allGenres = Object.entries(GENRE_MAP).filter(
    ([, name]) =>
      [
        "Action",
        "Adventure",
        "Animation",
        "Comedy",
        "Crime",
        "Drama",
        "Fantasy",
        "Horror",
        "Mystery",
        "Romance",
        "Sci-Fi",
        "Thriller",
      ].includes(name)
  );
  // Deduplicate by name (movie and TV share some genre labels)
  const seen = new Set<string>();
  const uniqueGenres = allGenres.filter(([, name]) => {
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
  // Anime is custom — not a TMDB genre, handled specially
  const ANIME_ID = 0;
  const genresWithAnime = [...uniqueGenres, [String(ANIME_ID), "Anime"]] as [string, string][];

  const filledCount = watched.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col">
      {/* Progress bar */}
      <div className="px-4 pt-6">
        <div className="flex gap-1 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i <= step ? "bg-[#6366f1]" : "bg-[#1a1a2e]"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 max-w-lg mx-auto w-full">
        {/* ─── STEP 1: Genres ─── */}
        {step === STEP.GENRES && (
          <>
            <h1 className="text-2xl font-bold mb-2 text-center">What do you enjoy?</h1>
            <p className="text-sm text-[#9ca3af] mb-8 text-center">
              Pick your favorite genres — we&apos;ll tailor recommendations just for you
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-sm">
              {genresWithAnime.map(([idStr, name]) => {
                const id = parseInt(idStr);
                return (
                  <GenreChip
                    key={id}
                    name={name}
                    selected={selectedGenres.includes(id)}
                    onClick={() =>
                      setSelectedGenres((prev) =>
                        prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
                      )
                    }
                  />
                );
              })}
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => setStep(STEP.WATCHED)}
                className="w-full py-3 bg-[#6366f1] hover:bg-[#5558e8] text-white font-semibold rounded-xl transition-colors"
              >
                Continue
              </button>
              <button
                onClick={() => setStep(STEP.WATCHED)}
                className="w-full py-2 text-sm text-[#6b7280] hover:text-[#9ca3af] transition-colors"
              >
                Skip
              </button>
            </div>
          </>
        )}

        {/* ─── STEP 2: Recently Watched ─── */}
        {step === STEP.WATCHED && (
          <>
            <h1 className="text-2xl font-bold mb-2 text-center">What have you watched?</h1>
            <p className="text-sm text-[#9ca3af] mb-6 text-center">
              Add up to 3 titles you&apos;ve seen recently and rate them
            </p>

            {/* Watched list */}
            <div className="w-full space-y-3 mb-4">
              {watched.map((w, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-3 flex items-center gap-3 ${
                    w ? "bg-[#1a1a2e]" : "bg-[#1a1a2e]/40 border border-dashed border-[#25253a]"
                  } min-h-[56px]`}
                >
                  {w?.poster ? (
                    <PosterImage
                      src={w.poster}
                      alt={w.title}
                      width={40}
                      height={56}
                      className="rounded flex-shrink-0"
                      sizes="40px"
                    />
                  ) : (
                    <div className="w-10 h-14 rounded bg-[#25253a] flex-shrink-0 flex items-center justify-center text-[#6b7280] text-xs">
                      {i + 1}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {w ? (
                      <>
                        <p className="text-sm font-medium text-white truncate">{w.title}</p>
                        <p className="text-xs text-[#6b7280]">
                          {w.year} · {w.type === "movie" ? "Movie" : "TV"}
                        </p>
                        <div className="mt-1">
                          <StarPicker value={w.userRating} onChange={(v) => setRating(i, v)} />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-[#6b7280]">
                        Search and add a title...
                      </p>
                    )}
                  </div>
                  {w && (
                    <button
                      onClick={() => removeWatched(i)}
                      className="text-[#6b7280] hover:text-red-400 text-lg flex-shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Search */}
            {filledCount < 3 && (
              <div className="w-full relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search movies or shows..."
                  className="w-full bg-[#1a1a2e] text-white text-sm rounded-xl px-4 py-3 outline-none border border-transparent focus:border-[#6366f1] transition-colors placeholder:text-[#6b7280]"
                />
                {loading && (
                  <div className="absolute right-4 top-3">
                    <div className="w-4 h-4 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* Dropdown */}
                {results.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-[#1a1a2e] border border-[#25253a] rounded-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => addWatched(r)}
                        disabled={watched.some((w) => w?.id === r.id)}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-[#25253a] transition-colors text-left disabled:opacity-30"
                      >
                        {r.poster ? (
                          <PosterImage
                            src={r.poster}
                            alt={r.title}
                            width={32}
                            height={48}
                            className="rounded flex-shrink-0"
                            sizes="32px"
                          />
                        ) : (
                          <div className="w-8 h-12 rounded bg-[#25253a] flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{r.title}</p>
                          <p className="text-xs text-[#6b7280]">
                            {r.year} · {r.type === "movie" ? "Movie" : "TV"}
                            {r.rating > 0 && ` · ★ ${r.rating}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-col gap-3 w-full max-w-xs mt-6">
              <button
                onClick={runCuration}
                disabled={loadingCuration}
                className="w-full py-3 bg-[#6366f1] hover:bg-[#5558e8] text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {loadingCuration ? "Finding your match..." : "Show my recommendation"}
              </button>
              <button
                onClick={runCuration}
                className="w-full py-2 text-sm text-[#6b7280] hover:text-[#9ca3af] transition-colors"
              >
                Skip
              </button>
            </div>
            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
          </>
        )}

        {/* ─── STEP 3: Curation Result ─── */}
        {step === STEP.CURATION && curation && (
          <div className="w-full flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-6 text-center">Your perfect match</h1>

            {/* Clean curation card — no overlays on image */}
            <div className="w-full max-w-[220px] mx-auto mb-6">
              {/* Poster with strong neon glow */}
              <div className="rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(99,102,241,0.4),0_0_60px_rgba(168,85,247,0.2)] ring-2 ring-[#6366f1]/30 aspect-[2/3] relative">
                <PosterImage
                  src={curation.item.poster?.replace("w342", "w780") || ""}
                  alt={curation.item.title}
                  fill
                  className="rounded-2xl"
                  priority
                />
              </div>

              {/* Metadata below image */}
              <div className="px-1 pt-4 space-y-3">
                {/* Rating + year + type */}
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[#f59e0b] font-semibold">★ {curation.item.rating}</span>
                  <span className="text-[#9ca3af]">{curation.item.year}</span>
                  <span className="text-[#9ca3af]">·</span>
                  <span className="text-[#9ca3af]">{curation.item.type === "movie" ? "Movie" : "TV"}</span>
                </div>

                {/* Genre tags */}
                {curation.item.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {curation.item.genres.map((g) => (
                      <span
                        key={g}
                        className="px-2.5 py-0.5 bg-[#1a1a2e] text-[#9ca3af] text-xs rounded-full"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Title */}
                <h2 className="text-xl font-bold text-white">{curation.item.title}</h2>

                {/* Synopsis */}
                {curation.item.overview && (
                  <p className="text-sm text-[#9ca3af] leading-relaxed line-clamp-4">
                    {curation.item.overview}
                  </p>
                )}
              </div>
            </div>

            <p className="text-sm text-[#9ca3af] mb-4 text-center">
              Want more picks like this?
            </p>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="w-full max-w-xs py-3 bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-semibold rounded-xl transition-all hover:scale-105"
            >
              Sign up
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
