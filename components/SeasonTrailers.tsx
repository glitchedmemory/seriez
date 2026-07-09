export default function SeasonTrailers({ trailers }: {
  trailers: { key: string; name: string; site: string; type: string }[];
}) {
  if (trailers.length === 0) return null;

  return (
    <section id="trailers" className="mt-6">
      <h2 className="text-lg font-semibold text-text-primary mb-3">🎬 Trailers</h2>
      <div className="space-y-3">
        {trailers.slice(0, 3).map((v) => (
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
