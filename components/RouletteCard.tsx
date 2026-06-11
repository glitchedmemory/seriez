"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PosterImage from "@/components/PosterImage";

interface RouletteResult {
  empty?: boolean;
  message?: string;
  id: number;
  mediaType: string;
  title: string;
  poster: string | null;
  backdrop: string | null;
  year: string;
  rating: number;
  genres: string[];
  overview: string;
  director: string;
  runtime: string | null;
  tagline: string;
  periodLabel?: string;
  spunType?: string;
}

const TYPE_EMOJI: Record<string, string> = {
  movie: "🎬",
  tv: "📺",
  anime: "🐾",
};

export default function RouletteCard() {
  const router = useRouter();
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState("");

  const spin = async () => {
    setSpinning(true);
    setMessage("");
    try {
      const res = await fetch("/api/roulette");
      const data = await res.json();
      if (data.empty) {
        setMessage(data.message);
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setMessage("Something went wrong. Try again!");
    }
    setSpinning(false);
  };

  return (
    <div className="bg-gradient-to-br from-[#1e1e3a] to-[#151530] rounded-2xl overflow-hidden border border-white/5 text-center">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <span className="text-2xl">🎲</span>
        <h3 className="text-sm font-semibold text-white mt-1">Feeling Lucky?</h3>
        <p className="text-[11px] text-[#6b7280] mt-1">
          Discover a random hit you might have missed
        </p>
      </div>

      {/* Center SPIN Button */}
      <div className="flex justify-center pb-5">
        <button
          onClick={spin}
          disabled={spinning}
          className="px-8 py-2.5 rounded-full bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-[#6366f1]/20"
        >
          {spinning ? "SPINNING..." : "🎰 SPIN"}
        </button>
      </div>

      {/* Result */}
      {result && (
        <button
          onClick={() => router.push(`/title/${result.id}?type=${result.mediaType}`)}
          className="w-full text-left flex gap-4 px-4 pb-4 group"
        >
          <div className="w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden bg-[#25253a]">
            {result.poster ? (
              <PosterImage
                src={result.poster}
                alt={result.title}
                width={96}
                height={144}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">
                🎬
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {result.spunType && (
                <span className="text-xs">{TYPE_EMOJI[result.spunType] || "🎬"}</span>
              )}
              <h3 className="text-sm font-bold text-white group-hover:text-[#a5b4fc] transition-colors">
                {result.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {result.year && <span className="text-[10px] text-[#6b7280]">{result.year}</span>}
              {result.runtime && (
                <>
                  <span className="text-[10px] text-[#4b5563]">·</span>
                  <span className="text-[10px] text-[#6b7280]">{result.runtime}</span>
                </>
              )}
              {result.rating > 0 && (
                <>
                  <span className="text-[10px] text-[#4b5563]">·</span>
                  <span className="text-[10px] text-[#f59e0b]">★ {result.rating}</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {result.genres.map((g) => (
                <span
                  key={g}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[#9ca3af]"
                >
                  {g}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-[#9ca3af] mt-1.5 line-clamp-2">
              {result.tagline && (
                <span className="italic text-[#6366f1]">"{result.tagline}" — </span>
              )}
              {result.overview}
            </p>
          </div>
        </button>
      )}

      {/* Empty/Error message */}
      {message && !result && (
        <p className="text-xs text-[#6b7280] px-4 pb-4 text-center">{message}</p>
      )}
    </div>
  );
}
