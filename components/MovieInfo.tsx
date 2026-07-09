import type { TmdbDetail } from "@/lib/tmdb";

function formatCurrency(n: number) {
  if (n === 0) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function MovieInfo({ detail }: { detail: TmdbDetail }) {
  const hasInfo = detail.type === "movie" && detail.director
    || detail.type === "tv" && (detail.createdBy || detail.networks)
    || detail.type === "movie" && (detail.budget || detail.revenue);

  if (!hasInfo) return null;

  return (
    <div className="mt-3 text-xs text-text-secondary space-y-0.5">
      {detail.type === "movie" && detail.director && (
        <p>Director:{" "}<span className="text-text-secondary">{detail.director}</span></p>
      )}
      {detail.type === "tv" && detail.createdBy && (
        <p>Created by:{" "}<span className="text-text-secondary">{detail.createdBy.join(", ")}</span></p>
      )}
      {detail.type === "tv" && detail.networks && (
        <p>Network:{" "}<span className="text-text-secondary">{detail.networks.join(", ")}</span></p>
      )}
      {detail.type === "movie" && detail.budget ? (
        <p>
          Budget:{" "}<span className="text-text-secondary">{formatCurrency(detail.budget)}</span>
          {detail.revenue ? (
            <>{" "}· Revenue:{" "}<span className="text-text-secondary">{formatCurrency(detail.revenue)}</span></>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
