export default function AnimeTrailer({ trailer }: { trailer: { id: string; site: string } | null }) {
  if (!trailer || trailer.site !== "YouTube") return null;

  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">🎬 Trailer</h2>
      <div className="aspect-video rounded-xl overflow-hidden bg-bg-card">
        <iframe
          src={`https://www.youtube.com/embed/${trailer.id}`}
          title="Trailer"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
