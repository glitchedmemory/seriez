"use client";

import { useRef } from "react";
import Image from "next/image";
import type { AnimeRecItem } from "@/lib/anilist";

export default function AnimeRecommendations({ recommendations }: { recommendations: AnimeRecItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  return (
    <section className="mt-8 px-4 md:px-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-text-primary">Recommended</h2>
        <div className="hidden md:flex gap-1">
          <button onClick={() => scroll("left")} className="w-8 h-8 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-text-primary text-sm transition-colors">←</button>
          <button onClick={() => scroll("right")} className="w-8 h-8 rounded-full bg-bg-card hover:bg-bg-surface flex items-center justify-center text-text-primary text-sm transition-colors">→</button>
        </div>
      </div>
      <div ref={ref} className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar scroll-smooth">
        {recommendations.slice(0, 12).map((item) => (
          <a key={item.id} href={`/title/${item.id}?type=anime`} className="flex-shrink-0 w-32 md:w-36 block snap-start group">
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-bg-card relative">
              {item.poster ? (
                <Image src={item.poster} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform" sizes="(max-width: 768px) 128px, 144px" />
              ) : (
                <div className="w-full h-full bg-bg-surface flex items-center justify-center text-text-secondary text-[10px]">No Image</div>
              )}
            </div>
            <p className="text-xs font-medium text-text-primary mt-2 line-clamp-2 group-hover:text-accent transition-colors">{item.title}</p>
            <div className="flex items-center gap-2 mt-1">
              {item.rating > 0 && <span className="text-[10px] text-accent font-semibold">{item.rating}</span>}
              {item.year > 0 && <span className="text-[10px] text-text-secondary">{item.year}</span>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
