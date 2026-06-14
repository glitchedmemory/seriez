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
            className="w-6 h-6 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-white text-xs transition-colors"
            aria-label="Scroll left"
          >
            ←
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-6 h-6 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-white text-xs transition-colors"
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
            className="flex-shrink-0 w-[180px] text-left group"
          >
            {/* 2x2 thumbnail grid */}
            <div className="grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden bg-bg-card aspect-square mb-2 group-hover:ring-1 ring-accent transition-all">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-[2/3] bg-bg-surface overflow-hidden">
                  {c.thumbnails[i] ? (
                    <PosterImage
                      src={c.thumbnails[i]!}
                      alt=""
                      width={90}
                      height={135}
                      className="w-full h-full object-cover"
                      sizes="90px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10 text-lg">
                      🎬
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Info */}
            <p className="text-xs font-medium text-white truncate">{c.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-[#f87171]">♥ {c.likesCount}</span>
              <span className="text-[10px] text-text-secondary">{c.itemCount} items</span>
            </div>
            <p className="text-[10px] text-text-secondary">by {c.owner}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
