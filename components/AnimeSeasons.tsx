type Relation = {
  id: number;
  title: string;
  type: string;
  format: string;
  seasonYear: number | null;
  season?: string | null;
  startDate?: { year: number | null; month: number | null; day: number | null } | null;
  status?: string;
  isOriginal?: boolean;
};

export default function AnimeSeasons({
  relations,
  currentId,
  currentTitle,
  currentYear,
  currentSeason,
}: {
  relations: Relation[];
  currentId: number;
  currentTitle: string;
  currentYear: number;
  currentSeason?: string | null;
}) {
  // Combine relations + current item. Preserve isOriginal so the sort below can
  // pin the earliest season (season 1) to the front.
  const allItems: { id: number; title: string; seasonYear: number | null; season?: string | null; startDate?: { year: number | null; month: number | null; day: number | null } | null; isOriginal?: boolean }[] = [
    ...relations.map(r => ({ id: r.id, title: r.title, seasonYear: r.seasonYear, season: r.season, startDate: r.startDate, isOriginal: r.isOriginal })),
    { id: currentId, title: currentTitle, seasonYear: currentYear || null, season: currentSeason || null, isOriginal: true },
  ];

  // Deduplicate by id
  const seen = new Set<number>();
  const uniqueItems = allItems.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Collapse "Part N" splits into ONE season. This must happen HERE (on the full
  // list including the current item) because enrichAnimeRelations excludes the
  // currentId — so "Season 2" (current, on its own page) and "Season 2 Part 2"
  // (a neighbor) only meet in this component. Group by title with any
  // " Part N" suffix stripped, keep one representative per group (prefer the
  // entry WITHOUT a Part suffix, then the current item, then the earliest).
  const stripPart = (t: string) => t.replace(/\s+Part\s+\d+\s*$/i, "").trim();
  const groups = new Map<string, { id: number; title: string; seasonYear: number | null; season?: string | null; startDate?: { year: number | null; month: number | null; day: number | null } | null; isOriginal?: boolean }[]>();
  const groupOrder: string[] = [];
  for (const item of uniqueItems) {
    const base = stripPart(item.title);
    if (!groups.has(base)) { groups.set(base, []); groupOrder.push(base); }
    groups.get(base)!.push(item);
  }
  const items: { id: number; title: string; seasonYear: number | null; season?: string | null; startDate?: { year: number | null; month: number | null; day: number | null } | null; isOriginal?: boolean }[] = [];
  for (const base of groupOrder) {
    const entries = groups.get(base)!;
    // Prefer the entry that is the current page; else the one without " Part N";
    // else the first (BFS order).
    const rep =
      entries.find(e => e.id === currentId) ||
      entries.find(e => !/\s+Part\s+\d+\s*$/i.test(e.title)) ||
      entries[0];
    items.push(rep);
  }

  // Sort by airing date: year (ascending) → season (WINTER/SPRING/SUMMER/FALL)
  // → month. Relying on seasonYear alone is insufficient because many modern
  // shows air multiple seasons within the SAME year (e.g. Hell Mode S1+S2 both
  // in 2026), which broke the S-number ordering. A season rank + start month
  // disambiguates same-year seasons. Items with no date go last.
  const SEASON_RANK: Record<string, number> = { WINTER: 1, SPRING: 2, SUMMER: 3, FALL: 4 };
  const byDate = (a: { seasonYear: number | null; season?: string | null; startDate?: { year: number | null; month: number | null; day: number | null } | null }, b: { seasonYear: number | null; season?: string | null; startDate?: { year: number | null; month: number | null; day: number | null } | null }) => {
    const ay = a.startDate?.year ?? a.seasonYear ?? Number.MAX_SAFE_INTEGER;
    const by = b.startDate?.year ?? b.seasonYear ?? Number.MAX_SAFE_INTEGER;
    if (ay !== by) return ay - by;
    const aRank = SEASON_RANK[(a.season || "").toUpperCase()] ?? Number.MAX_SAFE_INTEGER;
    const bRank = SEASON_RANK[(b.season || "").toUpperCase()] ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    const am = a.startDate?.month ?? Number.MAX_SAFE_INTEGER;
    const bm = b.startDate?.month ?? Number.MAX_SAFE_INTEGER;
    return am - bm;
  };
  items.sort(byDate);

  if (items.length <= 1) return null;

  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Seasons</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => {
          // Always render labels as sequential S1, S2, S3... (match the sorted order).
          // This keeps the label text uniform even for entries whose title has no
          // clean "Season N" (e.g. "Final Season" → last position → "S4").
          const label = `S${idx + 1}`;
          return (
            <a
              key={item.id}
              href={`/anime/${item.id}`}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                item.id === currentId
                  ? "bg-accent text-white cursor-default pointer-events-none shadow-md"
                  : "bg-bg-card text-text-secondary border border-border hover:bg-accent/10 hover:text-text-primary hover:border-accent/30"
              }`}
            >
              {label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
