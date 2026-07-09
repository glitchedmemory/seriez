import type { TmdbDetail } from "@/lib/tmdb";

export default function MovieTrailers({ videos }: { videos: TmdbDetail["videos"] }) {
  if (videos.length === 0) return null;

  return (
    <section id="trailers" className="mt-6">
      <h2 className="text-lg font-semibold text-text-primary mb-3">🎬 Trailers</h2>
      <div className="space-y-3">
        {videos.slice(0, 3).map((v) => (
          <div key={v.key} className="aspect-video rounded-xl overflow-hidden bg-bg-card">
            <iframe
              src={`https://www.youtube.com/embed/${v.key}`}
              title={v.name}
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
