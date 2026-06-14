interface GenreData {
  name: string;
  avgRating: number;
  count: number;
}

export default function TopGenres({ genres }: { genres: GenreData[] }) {
  if (genres.length === 0) {
    return (
      <div className="mb-6">
        <h3 className="text-[15px] font-bold text-text-primary tracking-tight mb-3">Top Genres</h3>
        <p className="text-text-secondary text-sm text-center py-4">
          Not enough data yet. Start rating titles!
        </p>
      </div>
    );
  }

  // Top 2 get primary styling
  return (
    <div className="mb-6">
      <h3 className="text-[15px] font-bold text-text-primary tracking-tight mb-3">Top Genres</h3>
      <div className="flex flex-wrap gap-2">
        {genres.slice(0, 5).map((genre, i) => (
          <span
            key={genre.name}
            className={`text-[13px] font-semibold px-3.5 py-1.5 rounded-full tracking-tight ${
              i < 2
                ? "bg-[#1e1b4b] text-[#a5b4fc]"
                : "bg-bg-card text-text-secondary"
            }`}
          >
            {genre.name}
          </span>
        ))}
      </div>
    </div>
  );
}
