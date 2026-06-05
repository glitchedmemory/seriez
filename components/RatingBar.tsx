"use client";

export function RatingBar({ rating }: { rating: number }) {
  // Simulate a distribution based on the average rating
  // Real implementation would pull from DB
  const bars = [5, 4, 3, 2, 1].map((star) => {
    // Generate plausible distribution centered around the avg rating
    const dist = 1 - Math.abs(star - (rating > 0 ? rating : 3.5)) * 0.4;
    const pct = Math.max(3, Math.round(dist * 100));
    return { star, pct };
  });

  const maxPct = Math.max(...bars.map((b) => b.pct));

  return (
    <div className="flex-1 max-w-[200px]">
      {bars.map(({ star, pct }) => (
        <div key={star} className="flex items-center gap-2">
          <span className="text-[10px] text-[#9ca3af] w-8 text-right flex-shrink-0">
            {star} ★
          </span>
          <div className="flex-1 h-1.5 bg-[#25253a] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#f59e0b] rounded-full transition-all"
              style={{
                width: `${Math.round((pct / maxPct) * 100)}%`,
              }}
            />
          </div>
          <span className="text-[10px] text-[#6b7280] w-6 text-right flex-shrink-0">
            {pct}%
          </span>
        </div>
      ))}
    </div>
  );
}
