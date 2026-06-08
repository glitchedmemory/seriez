interface GenreData {
  name: string;
  avgRating: number;
  count: number;
}

const MEDAL_COLORS: Record<number, { bg: string; text: string; bar: string }> = {
  0: { bg: "bg-amber-500/10", text: "text-amber-400", bar: "bg-amber-500" },
  1: { bg: "bg-gray-400/10", text: "text-gray-400", bar: "bg-gray-400" },
  2: { bg: "bg-orange-700/10", text: "text-orange-500", bar: "bg-orange-600" },
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function TopGenres({ genres }: { genres: GenreData[] }) {
  const maxCount = Math.max(...genres.map((g) => g.count), 1);

  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-5">
      <h2 className="text-white text-base font-bold mb-1">
        🏆 Top Genres
      </h2>
      <p className="text-[#6b7280] text-xs mb-4">
        Ranked by your average rating
      </p>

      {genres.length === 0 ? (
        <p className="text-[#6b7280] text-sm text-center py-4">
          Not enough data yet. Start rating titles!
        </p>
      ) : (
        <div className="space-y-3">
          {genres.map((genre, i) => {
            const colors = MEDAL_COLORS[i] || MEDAL_COLORS[2];
            const width = (genre.count / maxCount) * 100;
            return (
              <div
                key={genre.name}
                className={`rounded-xl p-3 ${colors.bg} border border-white/5`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{MEDALS[i]}</span>
                    <span className={`font-semibold text-sm ${colors.text}`}>
                      ★ {genre.avgRating}
                    </span>
                    <span className="text-white font-medium text-sm">
                      {genre.name}
                    </span>
                  </div>
                  <span className="text-[#6b7280] text-xs">
                    {genre.count} title{genre.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="h-2 bg-[#0f0f1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                    style={{ width: `${Math.max(width, 4)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
