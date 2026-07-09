import type { TmdbDetail } from "@/lib/tmdb";
import { stripHtml } from "@/lib/strip-html";

export default function MovieOverview({ overview }: { overview: TmdbDetail["overview"] }) {
  if (!overview) return null;

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-text-primary mb-2">Overview</h2>
      <p className="text-sm text-text-secondary leading-relaxed">{stripHtml(overview)}</p>
    </section>
  );
}
