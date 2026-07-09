import PosterImage from "@/components/PosterImage";

type Character = { name: string; role: string; voiceActor: string; image: string | null };

export default function AnimeCharacters({ characters }: { characters: Character[] }) {
  if (characters.length === 0) return null;

  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Characters & Voice Actors</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {characters.slice(0, 9).map((c, i) => (
          <div key={i} className="flex items-center gap-3 bg-bg-card border border-border rounded-xl p-3">
            {c.image && (
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-bg-surface">
                <PosterImage src={c.image} alt={c.name} width={40} height={40} className="object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
              <p className="text-[10px] text-text-secondary truncate">{c.role}</p>
              {c.voiceActor && (
                <p className="text-[10px] text-accent truncate">{c.voiceActor}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
