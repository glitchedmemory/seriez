"use client";

/**
 * 5‑star input — each star toggles: empty → half → full → empty.
 * Half‑star rendered via linear‑gradient, consistent with review display.
 */
export function StarInput({
  value,
  onChange,
}: {
  value: number; // 0–5, half‑star = x.5
  onChange: (rating: number) => void;
}) {
  const stars = [1, 2, 3, 4, 5];

  function handleClick(star: number) {
    const fullThreshold = star;
    const halfThreshold = star - 0.5;

    if (value >= fullThreshold) {
      onChange(Math.max(0, star - 1));
    } else if (value >= halfThreshold) {
      onChange(star);
    } else {
      onChange(star - 0.5);
    }
  }

  function starFill(star: number): number {
    if (value >= star) return 100;
    if (value >= star - 0.5) return 50;
    return 0;
  }

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((star) => {
        const fill = starFill(star);
        return (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            className="text-2xl select-none p-0 m-0 leading-none"
            style={{
              background:
                fill > 0
                  ? `linear-gradient(to right, #f59e0b ${fill}%, #4b5563 ${fill}%)`
                  : "#4b5563",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
