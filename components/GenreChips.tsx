"use client";

export function GenreChip({
  genre,
  active,
  onClick,
}: {
  genre: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
        active
          ? "bg-[#6366f1] text-white shadow-lg shadow-[#6366f1]/25"
          : "bg-[#1a1a2e] text-[#9ca3af] hover:text-white hover:bg-[#25253a]"
      }`}
    >
      {genre}
    </button>
  );
}

export function GenreChips({ selected, onSelect }: { selected: string; onSelect: (g: string) => void }) {
  const genres = ["All", "Action", "Sci-Fi", "Horror", "Comedy", "Drama", "Anime"];

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 hide-scrollbar">
      {genres.map((genre) => (
        <GenreChip
          key={genre}
          genre={genre}
          active={selected === genre}
          onClick={() => onSelect(genre)}
        />
      ))}
    </div>
  );
}
