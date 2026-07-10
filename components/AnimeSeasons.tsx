type Relation = { id: number; title: string; type: string; format: string; seasonYear: number | null };

function titleOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/[\s:]+/).filter(w => w.length > 1));
  const wordsB = new Set(b.toLowerCase().split(/[\s:]+/).filter(w => w.length > 1));
  let count = 0;
  for (const w of wordsA) if (wordsB.has(w)) count++;
  return count;
}

export default function AnimeSeasons({
  relations,
  currentId,
  currentTitle,
  currentYear,
}: {
  relations: Relation[];
  currentId: number;
  currentTitle: string;
  currentYear: number;
}) {
  const direct = relations.filter(r => titleOverlap(r.title, currentTitle) >= 2);
  const related = relations.filter(r => titleOverlap(r.title, currentTitle) < 2);

  const allItems = [
    ...direct,
    { id: currentId, title: currentTitle, type: "ANIME", format: "TV", seasonYear: currentYear || null },
  ];

  const sorted = [...allItems].sort(
    (a, b) => (a.seasonYear || 0) - (b.seasonYear || 0) || a.title.localeCompare(b.title)
  );

  if (sorted.length <= 1 && related.length === 0) return null;

  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Seasons</h2>
      <div className="flex flex-wrap gap-2">
        {sorted.length > 1 && sorted.map((r, i) => (
          <a
            key={r.id}
            href={`/title/${r.id}?type=anime`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              r.id === currentId
                ? "bg-accent text-white cursor-default pointer-events-none shadow-md"
                : "bg-bg-card text-text-secondary border border-border hover:bg-accent/10 hover:text-text-primary hover:border-accent/30"
            }`}
          >
            S{i + 1}
          </a>
        ))}
        {related.map((r) => (
          <a
            key={r.id}
            href={`/title/${r.id}?type=anime`}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-bg-card text-text-secondary border border-border hover:bg-accent/10 hover:text-text-primary hover:border-accent/30"
          >
            {r.title}
          </a>
        ))}
      </div>
    </div>
  );
}
