"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SearchSkeleton } from "@/components/Skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";
import PosterImage from "@/components/PosterImage";
import EmptyState from "@/components/EmptyState";
import PublishedCollections from "@/components/PublishedCollections";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingSearches, setTrendingSearches] = useState<{ id: number; title: string; type: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      <div className="sticky top-0 z-20 bg-[#0f0f1a] pt-4 pb-3 px-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b7280]"
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
            placeholder="Search movies, TV shows & anime..."
            aria-label="Search movies, TV shows and anime"
            className="w-full bg-[#1a1a2e] text-white text-sm rounded-xl pl-10 pr-4 py-3 outline-none border border-transparent focus:border-[#6366f1] transition-colors placeholder:text-[#6b7280]"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── AdSense Placeholder ── */}
      <div className="px-4 my-4">
        <div className="w-full h-[60px] rounded-xl border-2 border-dashed border-[#6366f1]/40 bg-[#1a1a2e]/50 flex items-center justify-center text-[#6b7280] text-xs gap-2">
          <span className="text-base">📢</span>
          <span className="font-medium text-[#9ca3af]">AdSense Banner</span>
          <span>320×50 / 320×100 responsive</span>
        </div>
      </div>

      {/* ── Trending Searches & Published Collections ── */}
      <div className="px-4">
        {!query && (
          <>
            {trendingSearches.length > 0 ? (
              <div>
                <p className="text-xs text-[#6b7280] mb-3 font-medium">🔥 Trending Searches</p>
                <div className="flex flex-wrap gap-2">
                  {trendingSearches.slice(0, 15).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setQuery(item.title); logSearch(item.title); }}
                      className="px-3 py-1.5 rounded-full bg-[#1a1a2e] hover:bg-[#2d2d4a] text-xs text-[#d1d5db] transition-colors border border-[#2d2d4a] hover:border-[#6366f1]"
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
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#1a1a2e] transition-colors text-left"
              >
                {/* Poster */}
                <div className="flex-shrink-0 w-12 aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a2e]">
                  {item.poster ? (
                    <PosterImage src={item.poster} alt={item.title} width={48} height={72} className="rounded-lg" sizes="48px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-xs font-bold">
                      {item.title.slice(0, 2)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[#6b7280]">
                      {item.type === "anime" ? "Anime" : item.type === "movie" ? "Movie" : "TV"}
                    </span>
                    {item.year && (
                      <span className="text-[10px] text-[#6b7280]">{item.year}</span>
                    )}
                    {item.rating > 0 && (
                      <span className="text-[10px] text-[#f59e0b]">
                        ★ {item.rating}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <svg
                  className="w-4 h-4 text-[#4b5563] flex-shrink-0"
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
