import { SearchClient } from "@/components/SearchClient";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  let trendingSearches: { id: number; title: string; type: string }[] = [];
  let collections: any[] = [];

  try {
    const [trendingRes, collectionsRes] = await Promise.all([
      fetch(`${BASE_URL}/api/trending-searches`, { next: { revalidate: 3600 } }),
      // no-store: Next.js would otherwise memoize this result for 30 min, so a
      // single AniList 429 render pinned null posters on every request after it.
      fetch(`${BASE_URL}/api/collections/published`, { cache: "no-store" }),
    ]);

    if (trendingRes.ok) {
      const data = await trendingRes.json();
      trendingSearches = data.searches || [];
    }

    if (collectionsRes.ok) {
      const data = await collectionsRes.json();
      collections = data.collections || [];
    }
  } catch {
    // fallback: empty arrays, SearchClient shows empty state
  }

  return <SearchClient initialTrending={trendingSearches} initialCollections={collections} />;
}
