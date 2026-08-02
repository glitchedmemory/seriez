"use client";

import { useRef } from "react";
import Image from "next/image";
import { titleHref } from "@/lib/title-utils";

type SimilarItem = { id: number; title: string; poster: string | null; rating: number; year: number; type: "movie" | "tv" };

export default function SeasonRecommendations({ items }: { items: SimilarItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-text-primary">Recommended</h2>
        <div className="hidden md:flex gap-1">
          <button onClick={() => scroll("left")} className="w-8 h-8 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-text-primary text-sm transition-colors">←</button>
          <button onClick={() => scroll("right")} className="w-8 h-8 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-text-primary text-sm transition-colors">→</button>
        </div>
      </div>
      <div ref={ref} className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar scroll-smooth">
        {items.map((item) => (
          <a key={item.id} href={titleHref(item.id, item.type)} className="flex-shrink-0 w-28 group">
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-bg-card group-hover:scale-105 transition-transform relative">
              <Image
                src={item.poster}
                alt={item.title}
                fill
                className="object-cover rounded-lg"
                sizes="112px"
              />
            </div>
            <p className="text-[11px] text-text-primary mt-1 line-clamp-1">{item.title}</p>
            <p className="text-[10px] text-text-secondary"><span className="sr-only">Seriez Rating: </span>★ {item.rating}/10</p>
          </a>
        ))}
      </div>
    </section>
  );
}
