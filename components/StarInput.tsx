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
            className="select-none p-0 m-0 leading-none bg-transparent border-0 cursor-pointer"
            style={{ fontSize: 32, lineHeight: 1 }}
          >
            {fill === 100 ? (
              <span style={{ color: "#f59e0b" }}>★</span>
            ) : fill === 50 ? (
              <span
                style={{
                  backgroundImage: "linear-gradient(to right, #f59e0b 50%, #4b5563 50%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                ★
              </span>
            ) : (
              <span style={{ color: "#4b5563" }}>☆</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
