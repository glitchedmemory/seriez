"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const REPORT_REASONS = [
  { value: "inappropriate", label: "👎 Inappropriate" },
  { value: "spam", label: "📢 Spam" },
  { value: "obscenity", label: "🔞 Obscenity" },
  { value: "hate_speech", label: "🗣️ Hate Speech" },
  { value: "spoiler", label: "🚨 Spoiler" },
  { value: "other", label: "··· Other" },
];

interface ReportButtonProps {
  target_type: "review" | "comment" | "collection";
  target_id: string | number;
  owner_username?: string; // hide if current user is the owner
  className?: string;
}

export default function ReportButton({ target_type, target_id, owner_username, className }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get current username from localStorage (set on login)
    const stored = localStorage.getItem("seriez-username");
    if (stored) setCurrentUser(stored);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Hide if it's the user's own content
  if (owner_username && currentUser && owner_username === currentUser) return null;
  if (!currentUser) return null;

  const handleReport = async (reason: string) => {
    setOpen(false);
    if (submitted) return;
    setSubmitting(true);
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type, target_id: String(target_id), username: currentUser, reason }),
      });
      setSubmitted(true);
    } catch {}
    setSubmitting(false);
  };

  return (
    <div ref={ref} className={`relative inline-block ${className || ""}`}>
      {submitted ? (
        <span className="text-[10px] text-green-400 cursor-default">Reported</span>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          disabled={submitting}
          className="text-xs text-text-secondary hover:text-red-400 transition-colors px-1"
          title="Report"
        >
          ···
        </button>
      )}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-bg-card border border-border rounded-lg shadow-xl py-1 min-w-[150px]">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => handleReport(r.value)}
              className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
