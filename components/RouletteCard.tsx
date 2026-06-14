"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  // IDLE — no result yet
  if (!result && !message) {
    return (
      <div className="relative bg-gradient-to-br from-[#1a1a3e] via-[#191938] to-[#13132e] rounded-2xl overflow-hidden border border-accent/10">
        {/* Subtle top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-[#6366f1]/40 to-transparent rounded-full" />

        <div className="flex flex-col items-center px-6 py-10 text-center">
          {/* Hero emoji */}
          <div className="relative mb-5">
            <span className="text-6xl">🎰</span>
            <span className="absolute -top-1 -right-2 text-xl">✨</span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-white mb-1.5">
            Feeling Lucky?
          </h3>

          {/* Description */}
          <p className="text-xs text-white/70 max-w-[240px] mb-8">
            Spin the wheel and discover a random hit from the recent past
          </p>

          {/* SPIN Button */}
          <button
            onClick={spin}
            disabled={spinning}
            className="group relative px-10 py-3 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white text-sm font-bold transition-all duration-200 hover:from-[#5558e6] hover:to-[#6366f1] hover:shadow-xl hover:shadow-[#6366f1]/30 active:scale-[0.97] disabled:opacity-50 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <span className="text-base">🎰</span>
              SPIN
            </span>
            {/* Shine effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </button>
        </div>
      </div>
    );
  }

  // MESSAGE — error / sign-in prompt
  if (message && !result) {
    return (
      <div className="bg-gradient-to-br from-[#1a1a3e] via-[#191938] to-[#13132e] rounded-2xl overflow-hidden border border-accent/10">
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="text-4xl mb-3">🎰</span>
          <p className="text-sm text-white/70 mb-6">{message}</p>
          <button
            onClick={spin}
            disabled={spinning}
            className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white text-sm font-bold transition-all hover:shadow-lg hover:shadow-[#6366f1]/30 active:scale-[0.97]"
          >
            {spinning ? "SPINNING..." : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  // RESULT — got a pick
  return (
    <div className="bg-gradient-to-br from-[#1a1a3e] via-[#191938] to-[#13132e] rounded-2xl overflow-hidden border border-accent/10">
      <button
        onClick={() => router.push(`/title/${result!.id}?type=${result!.mediaType}`)}
        className="w-full text-left group"
      >
        {/* Poster section */}
        <div className="relative aspect-[16/9] bg-[#0f0f23] overflow-hidden">
          {/* Reset button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setResult(null);
            }}
            className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-text-primary/70 hover:text-white text-sm transition-colors"
          >
            ✕
          </button>
          {result!.backdrop ? (
            <img
              src={result!.backdrop}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-60"
            />
          ) : result!.poster ? (
            <img
              src={result!.poster}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-60"
            />
          ) : null}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#13132e] via-[#13132e]/60 to-transparent" />

          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-center gap-2 mb-2">
              {result!.spunType && (
                <span className="text-sm bg-white/10 backdrop-blur rounded-lg px-2 py-1">
                  {TYPE_EMOJI[result!.spunType]}
                </span>
              )}
              <h3 className="text-lg font-bold text-white leading-tight">
                {result!.title}
              </h3>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              {result!.year && (
                <span className="text-xs text-[#c4b5fd]">{result!.year}</span>
              )}
              {result!.runtime && (
                <span className="text-xs text-white/50">{result!.runtime}</span>
              )}
              {result!.rating > 0 && (
                <span className="text-xs text-amber-400 font-medium">
                  ★ {result!.rating}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details section */}
        <div className="p-4">
          {/* Genres */}
          {result!.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {result!.genres.map((g) => (
                <span
                  key={g}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/5"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Overview */}
          <p className="text-xs text-white/60 leading-relaxed line-clamp-2">
            {result!.tagline && (
              <span className="italic text-[#c4b5fd]">"{result!.tagline}"{" "}</span>
            )}
            {result!.overview}
          </p>
        </div>
      </button>
    </div>
  );
}
