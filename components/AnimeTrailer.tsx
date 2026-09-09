export default function AnimeTrailer({ trailers }: { trailers: { key: string; name: string }[] }) {
  if (!trailers || trailers.length === 0) return null;

  return (
    <section id="trailers" className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-3">🎬 Trailers</h2>
      <div className="space-y-3">
        {trailers.slice(0, 3).map((v) => (
          <div key={v.key} className="aspect-video rounded-xl overflow-hidden bg-bg-card">
            <iframe
              src={`https://www.youtube.com/embed/${v.key}`}
              title={v.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
