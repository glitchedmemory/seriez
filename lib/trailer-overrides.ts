// Manual trailer overrides for titles whose official trailer is not yet on TMDB.
// Used when TMDB has no Trailer/Teaser videos — we show the pinned official video
// instead of falling back to ambiguous YouTube searches (which can surface
// unrelated titles with the same name).
//
// Format: key = TMDB series id, value = YouTube video info.
export const TRAILER_OVERRIDES: Record<number, { key: string; name: string }> = {
  // 스캔들 (The Scandal) — Netflix KR original (Son Ye-jin, Ji Chang-wook, Nana).
  // Premieres Q3 2026, still In Production, no dedicated trailer on TMDB/Netflix yet.
  // Pinned: official "2026 Netflix K-Content Lineup" video that includes this title.
  275102: {
    key: "DuyVg7Sam6w",
    name: "2026 Netflix K-Content Lineup | What Next? | Netflix",
  },
};
