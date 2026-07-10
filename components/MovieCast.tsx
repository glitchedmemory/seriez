"use client";

import { useState } from "react";
import Image from "next/image";

interface CastMember { id: number; name: string; character: string; photo: string | null; }

export default function MovieCast({ cast }: { cast: CastMember[] }) {
  const [showAll, setShowAll] = useState(false);
  const directors = cast.filter((c) => c.character === "Director");
  const actors = cast.filter((c) => c.character !== "Director");

  const visibleDirectors = showAll ? directors : directors.slice(0, 5);
  const visibleActors = showAll ? actors : actors.slice(0, 10);

  return (
    <>
      {directors.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Director{directors.length > 1 ? "s" : ""}</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {visibleDirectors.map((c) => (
              <a
                key={c.name}
                href={`/person/${c.id}`}
                className="bg-bg-card rounded-xl p-2 text-center hover:bg-bg-surface transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-bg-surface mb-2 relative">
                  <Image src={c.photo || ""} alt={c.name} fill className="object-cover rounded-full" sizes="(max-width: 768px) 48px, 64px" />
                </div>
                <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
                <p className="text-[10px] text-text-secondary truncate">Director</p>
              </a>
            ))}
          </div>
          {directors.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-3 text-xs text-accent hover:underline mx-auto block"
            >
              {showAll ? "Show less" : `Show all ${directors.length} directors`}
            </button>
          )}
        </section>
      )}
      {actors.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Cast</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {visibleActors.map((c) => (
              <a
                key={c.name}
                href={`/person/${c.id}`}
                className="bg-bg-card rounded-xl p-2 text-center hover:bg-bg-surface transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-bg-surface mb-2 relative">
                  <Image src={c.photo || ""} alt={c.name} fill className="object-cover rounded-full" sizes="(max-width: 768px) 48px, 64px" />
                </div>
                <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
                <p className="text-[10px] text-text-secondary truncate">{c.character}</p>
              </a>
            ))}
          </div>
          {actors.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-3 text-xs text-accent hover:underline mx-auto block"
            >
              {showAll ? "Show less" : `Show all ${actors.length} cast members`}
            </button>
          )}
        </section>
      )}
    </>
  );
}
