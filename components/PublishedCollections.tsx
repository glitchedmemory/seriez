"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import PosterImage from "@/components/PosterImage";

interface Collection {
  id: string;
  name: string;
  owner: string;
  likesCount: number;
  itemCount: number;
  thumbnails: (string | null)[];
}

export default function PublishedCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/collections/published")
      .then((res) => res.json())
      .then((data) => setCollections(data.collections || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Shuffle order on each mount
  const [shuffled, setShuffled] = useState<Collection[]>([]);
  useEffect(() => {
    if (collections.length > 0) {
      setShuffled([...collections].sort(() => Math.random() - 0.5));
    }
  }, [collections]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -260 : 260, behavior: "smooth" });
  };

  if (loading || shuffled.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-secondary font-medium">📚 Curated Collections</p>
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="w-6 h-6 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-text-primary text-xs transition-colors"
            aria-label="Scroll left"
          >
            ←
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-6 h-6 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-text-primary text-xs transition-colors"
            aria-label="Scroll right"
          >
            →
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar scroll-smooth"
      >
        {shuffled.map((c) => (
          <button
            key={c.id}
            onClick={() => router.push(`/collections/${c.id}`)}
            className="flex-shrink-0 w-[150px] text-left group"
          >
            {/* Stacked Posters + Gradient Overlay */}
            <div className="relative aspect-[2/3] text-left group">
              {/* Behind poster 2 — bottom-right peek */}
              {c.thumbnails[2] && (
                <div className="absolute -bottom-1 -right-1 w-[85%] h-[85%] z-0 rounded-xl overflow-hidden opacity-45 rotate-[6deg] shadow-lg">
                  <PosterImage
                    src={c.thumbnails[2]!}
                    alt=""
                    width={128}
                    height={192}
                    className="w-full h-full object-cover"
                    sizes="128px"
                  />
                </div>
              )}
              {/* Behind poster 1 — top-left peek */}
              {c.thumbnails[1] && (
                <div className="absolute -top-1 -left-1 w-[88%] h-[88%] z-[5] rounded-xl overflow-hidden opacity-60 -rotate-[4deg] shadow-lg">
                  <PosterImage
                    src={c.thumbnails[1]!}
                    alt=""
                    width={132}
                    height={198}
                    className="w-full h-full object-cover"
                    sizes="132px"
                  />
                </div>
              )}
              {/* Main poster — front */}
              <div className="absolute inset-0 z-10 rounded-xl overflow-hidden shadow-xl group-hover:ring-1 ring-accent transition-all">
                {c.thumbnails[0] ? (
                  <PosterImage
                    src={c.thumbnails[0]!}
                    alt={c.name}
                    width={150}
                    height={225}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="150px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-primary/10 text-2xl">
                    🎬
                  </div>
                )}
              </div>
              {/* Gradient overlay */}
              <div className="absolute inset-x-0 bottom-0 z-20 h-[55%] bg-gradient-to-t from-[#0a0a14]/95 via-[#0a0a14]/50 to-transparent light:from-[#1a1a2e]/85 light:via-[#1a1a2e]/35 pointer-events-none rounded-b-xl" />
              {/* Text */}
              <div className="absolute inset-x-0 bottom-0 z-30 p-3 pointer-events-none">
                <p className="text-xs font-semibold text-white truncate drop-shadow-sm">{c.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[#f87171] drop-shadow-sm">♥ {c.likesCount}</span>
                  <span className="text-[10px] text-white/70 drop-shadow-sm">{c.itemCount} items</span>
                </div>
                <p className="text-[10px] text-white/50 drop-shadow-sm">by {c.owner}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
