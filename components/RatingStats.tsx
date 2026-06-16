"use client";

interface RatingStatsData {
  average: number;
  total: number;
  distribution: Record<number, number>; // 0.5-5.0 → count
}

export function RatingStats({ stats }: { stats: RatingStatsData }) {
  const stars = [1.0, 2.0, 3.0, 4.0, 5.0];
  const maxCount = Math.max(...stars.map((s) => stats.distribution[s] || 0), 1);

  return (
    <div className="px-4 py-3">
      {/* Average rating */}
      <p className="text-[13px] font-medium text-[#1a1a1a]">Average Rating</p>
      <p className="text-[34px] font-bold text-[#1a1a1a] leading-tight">
        {stats.average > 0 ? stats.average.toFixed(1) : "—"}
      </p>

      {/* Total ratings */}
      <p className="text-[11px] text-[#8e8e8e] mt-1">Total Ratings</p>
      <p className="text-[13px] font-semibold text-[#1a1a1a]">
        {stats.total >= 10000
          ? `${(stats.total / 10000).toFixed(1)}M`
          : stats.total >= 1000
            ? `${(stats.total / 1000).toFixed(1)}K`
            : String(stats.total)}
      </p>

      {/* Vertical bar chart — CSS grid, unified baseline */}
      <div
        className="mt-4"
        style={{
          display: "grid",
          gridTemplateRows: "1fr 14px 16px",
          gridTemplateColumns: "repeat(5, 1fr)",
          height: "80px",
        }}
      >
        {/* Row 1: Bar area — all cells identical height, bars grow from bottom */}
        {stars.map((star) => {
          const count = stats.distribution[star] || 0;
          const heightPercent = count > 0 ? (count / maxCount) * 100 : 0;
          const barColor =
            star <= Math.round(stats.average) ? "#ff2f6e" : "#e0e0e0";
          return (
            <div
              key={`bar-${star}`}
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "36px",
                  height: count > 0 ? `${Math.max(heightPercent, 4)}%` : "0%",
                  backgroundColor: barColor,
                  borderTopLeftRadius: "3px",
                  borderTopRightRadius: "3px",
                  transition: "height 0.5s",
                }}
              />
            </div>
          );
        })}
        {/* Row 2: Count labels */}
        {stars.map((star) => {
          const count = stats.distribution[star] || 0;
          return (
            <span
              key={`cnt-${star}`}
              className="text-[10px] text-[#8e8e8e] text-center"
            >
              {count > 0 ? count : ""}
            </span>
          );
        })}
        {/* Row 3: X-axis labels */}
        {stars.map((star) => (
          <span
            key={`lbl-${star}`}
            className="text-[12px] font-medium text-[#8e8e8e] text-center"
          >
            {star}
          </span>
        ))}
      </div>
    </div>
  );
}
