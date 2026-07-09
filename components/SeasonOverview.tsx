import { stripHtml } from "@/lib/strip-html";

export default function SeasonOverview({ overview, seasonOverview }: {
  overview: string;
  seasonOverview: string;
}) {
  return (
    <>
      {overview && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Overview</h2>
          <p className="text-sm text-text-secondary leading-relaxed">{stripHtml(overview)}</p>
        </section>
      )}
      {seasonOverview && seasonOverview !== overview && (
        <section className="mt-4">
          <h2 className="text-md font-semibold text-text-secondary mb-1">About This Season</h2>
          <p className="text-sm text-text-secondary leading-relaxed">{stripHtml(seasonOverview)}</p>
        </section>
      )}
    </>
  );
}
