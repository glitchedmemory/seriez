import PosterImage from "@/components/PosterImage";

interface CastMember {
  id: number;
  name: string;
  character: string;
  photo: string | null;
}

export default function SeasonCast({ cast }: { cast: CastMember[] }) {
  const directors = cast.filter((c) => c.character === "Director");
  const actors = cast.filter((c) => c.character !== "Director");

  return (
    <>
      {directors.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Directors</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {directors.map((c) => (
              <a
                key={c.name}
                href={`/person/${c.id}`}
                className="bg-bg-card rounded-xl p-2 text-center hover:bg-bg-surface transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-bg-surface mb-2 relative">
                  <PosterImage
                    src={c.photo}
                    alt={c.name}
                    fill
                    className="rounded-full"
                    sizes="(max-width: 768px) 48px, 64px"
                  />
                </div>
                <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
                <p className="text-[10px] text-text-secondary truncate">Director</p>
              </a>
            ))}
          </div>
        </section>
      )}
      {actors.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Cast</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {actors.map((c) => (
              <a
                key={c.name}
                href={`/person/${c.id}`}
                className="bg-bg-card rounded-xl p-2 text-center hover:bg-bg-surface transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-bg-surface mb-2 relative">
                  <PosterImage
                    src={c.photo}
                    alt={c.name}
                    fill
                    className="rounded-full"
                    sizes="(max-width: 768px) 48px, 64px"
                  />
                </div>
                <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
                <p className="text-[10px] text-text-secondary truncate">{c.character}</p>
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
