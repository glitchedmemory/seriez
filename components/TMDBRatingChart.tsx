"use client";

/** Vertical bar chart showing estimated rating distribution based on TMDB average */
export function TMDBRatingChart({ rating, total }: { rating: number; total: number }) {
  // Map TMDB 10-point average to a bell-curve distribution across 5 bars (2,4,6,8,10)
  const avg = rating > 0 ? rating : 5;
  const bars = [2, 4, 6, 8, 10].map((score) => {
    // Distance from average — closer = taller bar
    const dist = Math.abs(score - avg);
    const pct = Math.max(5, Math.round((1 - dist / 8) * 100));
    return { score, pct };
  });
  const maxPct = Math.max(...bars.map((b) => b.pct));

  return (
    <div className="flex items-end gap-[6px] h-[72px]">
      {bars.map(({ score, pct }) => {
        const heightPct = (pct / maxPct) * 100;
        const active = score <= avg;
        return (
          <div key={score} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-white/30">{pct}%</span>
            <div className="w-full flex-1 flex items-end justify-center">
              <div
                className="w-full rounded-t-[3px] transition-all duration-500"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: active ? "#ff2f6e" : "#25253a",
                }}
              />
            </div>
            <span className="text-[11px] text-white/30">{score}</span>
          </div>
        );
      })}
    </div>
  );
}
