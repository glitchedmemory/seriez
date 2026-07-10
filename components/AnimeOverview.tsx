export default function AnimeOverview({ overview }: { overview: string }) {
  if (!overview) return null;
  return (
    <div className="mt-8 px-4 md:px-0">
      <h2 className="text-lg font-semibold text-text-primary mb-2">Overview</h2>
      <div
        className="text-sm text-text-secondary leading-relaxed"
        dangerouslySetInnerHTML={{ __html: overview }}
      />
    </div>
  );
}
