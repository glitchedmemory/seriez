"use client";

import { useState } from "react";
import Image from "next/image";

type Character = { name: string; role: string; voiceActor: string; image: string | null };

export default function AnimeCharacters({ characters }: { characters: Character[] }) {
  if (characters.length === 0) return null;

  const [showAll, setShowAll] = useState(false);
  const mainCharacters = characters.filter((c) => c.role === "MAIN");
  const supportingCharacters = characters.filter((c) => c.role !== "MAIN");

  const visibleMain = showAll ? mainCharacters : mainCharacters.slice(0, 10);
  const visibleSupporting = showAll ? supportingCharacters : supportingCharacters.slice(0, 10);

  return (
    <>
      {mainCharacters.length > 0 && (
        <section className="mt-8 px-4 md:px-0">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Cast</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {visibleMain.map((c) => (
              <div key={c.name} className="bg-bg-card rounded-xl p-2 text-center hover:bg-bg-surface transition-colors">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-bg-surface mb-2 relative">
                  <Image src={c.image || ""} alt={c.name} fill className="object-cover rounded-full" sizes="(max-width: 768px) 48px, 64px" />
                </div>
                <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
                <p className="text-[10px] text-text-secondary truncate">{c.role}</p>
                {c.voiceActor && (
                  <p className="text-[10px] text-accent truncate">{c.voiceActor}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {supportingCharacters.length > 0 && (
        <section className="mt-6 px-4 md:px-0">
          <h2 className="text-sm font-semibold text-text-secondary mb-2">Supporting</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {visibleSupporting.map((c) => (
              <div key={c.name} className="bg-bg-card rounded-xl p-2 text-center hover:bg-bg-surface transition-colors">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full overflow-hidden bg-bg-surface mb-2 relative">
                  <Image src={c.image || ""} alt={c.name} fill className="object-cover rounded-full" sizes="(max-width: 768px) 48px, 64px" />
                </div>
                <p className="text-xs font-medium text-text-primary truncate">{c.name}</p>
                <p className="text-[10px] text-text-secondary truncate">{c.role}</p>
                {c.voiceActor && (
                  <p className="text-[10px] text-accent truncate">{c.voiceActor}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {(mainCharacters.length > 10 || supportingCharacters.length > 10) && (
        <div className="px-4 md:px-0">
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-3 text-xs text-accent hover:underline mx-auto block"
          >
            {showAll ? "Show less" : `Show all ${mainCharacters.length + supportingCharacters.length} characters`}
          </button>
        </div>
      )}
    </>
  );
}
