"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { SearchSkeleton } from "@/components/Skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";
import PosterImage from "@/components/PosterImage";
import EmptyState from "@/components/EmptyState";
import PublishedCollections from "@/components/PublishedCollections";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  const t = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingSearches, setTrendingSearches] = useState<{ id: number; title: string; type: string }[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [decadeResults, setDecadeResults] = useState<any[]>([]);
  const [decadeLoading, setDecadeLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const yearOptions = [
    { label: "2020s", range: [2020, 2029] as [number, number] },
    { label: "2010s", range: [2010, 2019] as [number, number] },
    { label: "2000s", range: [2000, 2009] as [number, number] },
    { label: "1990s", range: [1990, 1999] as [number, number] },
    { label: "Classic", range: [1900, 1989] as [number, number] },
  ];

  // Fetch decade results from discover API
  async function fetchByDecade(yearLabel: string) {
    const option = yearOptions.find((yo) => yo.label === yearLabel);
    if (!option) return;
    setDecadeLoading(true);
    try {
      const res = await fetch(
        `/api/discover-by-year?startYear=${option.range[0]}&endYear=${option.range[1]}`
      );
      if (res.ok) {
        const data = await res.json();
        setDecadeResults(data.results || []);
      }
    } catch {
      setDecadeResults([]);
    } finally {
      setDecadeLoading(false);
    }
  }

  function handleYearClick(yearLabel: string) {
    if (selectedYear === yearLabel) {
      setSelectedYear("");
      setDecadeResults([]);
      return;
    }
    setSelectedYear(yearLabel);
    fetchByDecade(yearLabel);
  }

  // Fetch trending searches on mount
  useEffect(() => {
    fetch("/api/trending-searches")
      .then((res) => res.json())
      .then((data) => setTrendingSearches(data.searches || []))
      .catch(() => {});
  }, []);

  // Log search when user clicks a trending term or presses Enter
  function logSearch(q: string) {
    fetch("/api/search-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    }).catch(() => {});
  }

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced auto-search while typing
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 100);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  // Enter key = immediate search
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      clearTimeout(debounceRef.current);
      doSearch(query);
      logSearch(query);
    }
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <ErrorBoundary sectionName="Search">
    <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
      {/* Search input */}
      <div className="sticky top-0 z-20 bg-bg-primary pt-4 pb-3 px-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("search.placeholder")}
            aria-label="Search movies, TV shows and anime"
            className="w-full bg-bg-card text-text-primary text-sm rounded-xl pl-10 pr-4 py-3 outline-none border border-transparent focus:border-accent transition-colors placeholder:text-text-secondary"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Year Quick-Pills ── */}
      <div className="px-4 mt-4 mb-2">
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {yearOptions.map((yo) => (
            <button
              key={yo.label}
              onClick={() => handleYearClick(yo.label)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                selectedYear === yo.label
                  ? "bg-accent text-white"
                  : "bg-bg-card text-text-secondary border border-border hover:border-accent hover:text-text-primary"
              }`}
            >
              {yo.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trending Searches & Published Collections ── */}
      <div className="px-4">
        {!query && !selectedYear && (
          <>
            {trendingSearches.length > 0 ? (
              <div>
                <p className="text-xs text-text-secondary mb-3 font-medium">🔥 {t("search.trendingSearches")}</p>
                <div className="flex flex-wrap gap-2">
                  {trendingSearches.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setQuery(item.title); logSearch(item.title); }}
                      className="px-3 py-1.5 rounded-full bg-bg-card hover:bg-bg-card-hover text-xs text-text-primary transition-colors border border-border hover:border-accent"
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon="🎥" title="Search movies, TV & anime" description="Find your next favorite title. Try searching for a genre, actor, or director." />
            )}

            {/* Published Collections — below Trending Searches */}
            {trendingSearches.length > 0 && (
              <div className="mt-5">
                <PublishedCollections />
              </div>
            )}
          </>
        )}

        {/* Decade Results (year pill active) */}
        {selectedYear && (
          <>
            {decadeLoading ? (
              <SearchSkeleton />
            ) : decadeResults.length > 0 ? (
              <div>
                <p className="text-xs text-text-secondary mb-3 font-medium">
                  📅 {selectedYear} &middot; {decadeResults.length} titles
                </p>
                <div className="space-y-1">
                  {decadeResults.map((item: any) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => router.push(`/title/${item.id}?type=${item.type}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bg-card transition-colors text-left"
                    >
                      <div className="flex-shrink-0 w-12 aspect-[2/3] rounded-lg overflow-hidden bg-bg-card">
                        {item.poster ? (
                          <PosterImage src={item.poster} alt={item.title} width={48} height={72} className="rounded-lg" sizes="48px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-primary/20 text-xs font-bold">
                            {item.title.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-text-secondary">
                            {item.type === "anime" ? "Anime" : item.type === "movie" ? "Movie" : "TV"}
                          </span>
                          {item.year && <span className="text-[10px] text-text-secondary">{item.year}</span>}
                          {item.rating > 0 && <span className="text-[10px] text-gold">★ {item.rating}</span>}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon="📅" title={`No results for ${selectedYear}`} description="Try a different decade or search for a specific title." />
            )}
          </>
        )}

        {/* Search Results */}
        {loading && <SearchSkeleton />}

        {!loading && query && results.length === 0 && (
          <EmptyState icon="🔍" title="No results found" description={`We couldn't find anything for "${query}". Try a different search term.`} />
        )}

        {query && results.length > 0 && (
          <div className="space-y-1">
            {results.map((item: any) => (
              <button
                key={item.id}
                onClick={() => router.push(`/title/${item.id}?type=${item.type}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bg-card transition-colors text-left"
              >
                {/* Poster */}
                <div className="flex-shrink-0 w-12 aspect-[2/3] rounded-lg overflow-hidden bg-bg-card">
                  {item.poster ? (
                    <PosterImage src={item.poster} alt={item.title} width={48} height={72} className="rounded-lg" sizes="48px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-primary/20 text-xs font-bold">
                      {item.title.slice(0, 2)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-text-secondary">
                      {item.type === "anime" ? "Anime" : item.type === "movie" ? "Movie" : "TV"}
                    </span>
                    {item.year && (
                      <span className="text-[10px] text-text-secondary">{item.year}</span>
                    )}
                    {item.rating > 0 && (
                      <span className="text-[10px] text-gold">
                        ★ {item.rating}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <svg
                  className="w-4 h-4 text-text-secondary flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
