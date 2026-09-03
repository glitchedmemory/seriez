"use client";

import { useState } from "react";

export default function ShareButton({
  title,
  url,
  variant = "backdrop",
}: {
  title: string;
  url: string;
  variant?: "backdrop" | "inline";
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const shareData = { title, text: `${title} — Seriez`, url };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled the share sheet — nothing to do.
      }
      return;
    }
    // Fallback: copy the URL to the clipboard.
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — leave button inert, show nothing.
    }
  }

  if (variant === "inline") {
    return (
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-bg-card text-text-secondary hover:text-text-primary hover:border-accent transition-colors cursor-pointer"
      >
        <ShareIcon />
        {copied ? "Link copied!" : "Share"}
      </button>
    );
  }

  // Backdrop variant: overlaid on the hero image, bottom-right corner.
  return (
    <button
      onClick={handleShare}
      aria-label="Share"
      className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-black/40 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 hover:border-white/40 transition-colors cursor-pointer"
    >
      <ShareIcon />
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
