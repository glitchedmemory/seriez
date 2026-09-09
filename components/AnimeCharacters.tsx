"use client";

import { useState } from "react";
import Image from "next/image";

type Character = { name: string; role: string; voiceActor: string; image: string | null };
type Staff = { id: number; name: string; role: string; image: string | null };

export default function AnimeCharacters({
  staff = [],
  characters,
}: {
  staff?: Staff[];
  characters: Character[];
}) {
  const [showAll, setShowAll] = useState(false);
  const directors = staff.filter((s) => /director/i.test(s.role));
  // MAIN first, then supporting — single unified "Cast" section (matches movie/tv detail pages).
  const cast = [
    ...characters.filter((c) => c.role === "MAIN"),
    ...characters.filter((c) => c.role !== "MAIN"),
  ];

  const visibleDirectors = showAll ? directors : directors.slice(0, 5);
  const visibleCast = showAll ? cast : cast.slice(0, 10);

  return (
    <>
      {directors.length > 0 && (
        <section className="mt-6 px-4 md:px-0">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Director{directors.length > 1 ? "s" : ""}</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {visibleDirectors.map((d) => (
              <div key={d.id} className="bg-bg-card rounded-xl p-2 text-center hover:bg-bg-surface transition-colors">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-bg-surface mb-2 relative">
                  <Image src={d.image || ""} alt={d.name} fill className="object-cover rounded-full" sizes="(max-width: 768px) 48px, 64px" />
                </div>
                <p className="text-xs font-medium text-text-primary truncate">{d.name}</p>
                <p className="text-[10px] text-text-secondary truncate">Director</p>
              </div>
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
      {cast.length > 0 && (
        <section className="mt-6 px-4 md:px-0">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Cast</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {visibleCast.map((c) => (
              <div key={c.name} className="bg-bg-card rounded-xl p-2 text-center hover:bg-bg-surface transition-colors">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-bg-surface mb-2 relative">
                  <Image src={c.image || ""} alt={c.name} fill className="object-cover rounded-full" sizes="(max-width: 768px) 48px, 64px" />
                </div>
                <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
                {c.voiceActor && (
                  <p className="text-[10px] text-accent truncate">{c.voiceActor}</p>
                )}
              </div>
            ))}
          </div>
          {cast.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-3 text-xs text-accent hover:underline mx-auto block"
            >
              {showAll ? "Show less" : `Show all ${cast.length} cast members`}
            </button>
          )}
        </section>
      )}
    </>
  );
}
