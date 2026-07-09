import type { AnimeRecItem } from "@/lib/anilist";
import PosterImage from "@/components/PosterImage";

export default function AnimeRecommendations({ recommendations }: { recommendations: AnimeRecItem[] }) {
  if (recommendations.length === 0) return null;

  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">Recommendations</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
        {recommendations.slice(0, 12).map((item) => (
          <a key={item.id} href={`/title/${item.id}?type=anime`} className="flex-shrink-0 w-32 md:w-36 block snap-start group">
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-bg-card">
              <PosterImage src={item.poster} alt={item.title} fill className="group-hover:scale-105 transition-transform" sizes="(max-width: 768px) 128px, 144px" />
            </div>
            <p className="text-xs font-medium text-text-primary mt-2 line-clamp-2 group-hover:text-accent transition-colors">{item.title}</p>
            <div className="flex items-center gap-2 mt-1">
              {item.rating > 0 && <span className="text-[10px] text-accent font-semibold">{item.rating}</span>}
              {item.year > 0 && <span className="text-[10px] text-text-secondary">{item.year}</span>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
