"use client";

import { useEffect, useRef } from "react";

interface VisitTrackerProps {
  tmdbId: number;
  mediaType: string;
  source?: string;
  username?: string;
}

/**
 * Fires a visit tracking POST to /api/visit on mount.
 * Place this inside any title page to record content visits.
 */
export default function VisitTracker({ tmdbId, mediaType, source, username }: VisitTrackerProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const searchParams = new URLSearchParams(window.location.search);
    const ref =
      searchParams.get("utm_source") ||
      searchParams.get("utm_medium") ||
      searchParams.get("ref") ||
      searchParams.get("source") ||
      source ||
      "direct";

    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdbId,
        mediaType,
        source: ref,
        username: username || undefined,
      }),
    }).catch(() => {});
  }, [tmdbId, mediaType, source, username]);

  return null;
}
