"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";

interface Poll {
  id: string;
  question: Record<string, string>;
  options: Record<string, string[]>;
  ends_at: string | null;
  total: number;
  counts: number[];
}

export default function PollCard() {
  const t = useTranslations();
  const locale = useLocale();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [myOption, setMyOption] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/polls")
      .then((r) => r.json())
      .then((data) => {
        if (data.polls && data.polls.length) setPoll(data.polls[0]);
      })
      .catch(() => {});
  }, []);

  const localize = (map: Record<string, string> | undefined, fallback: string) => {
    if (!map) return fallback;
    return map[locale] || map["en"] || fallback;
  };

  const localizeOptions = (map: Record<string, string[]> | undefined): string[] => {
    if (!map) return [];
    const arr = map[locale] || map["en"];
    return Array.isArray(arr) ? arr : [];
  };

  if (!poll) return null;

  const question = localize(poll.question, "");
  const options = localizeOptions(poll.options);
  const total = poll.total || 0;
  const counts = poll.counts || [];

  // 마감 표시
  const hasVoted = myOption !== null;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const handleVote = async (idx: number) => {
    if (hasVoted || voting) return;
    setVoting(true);
    setError(null);
    try {
      const res = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, optionIndex: idx }),
      });
      const data = await res.json();
      if (res.ok) {
        setMyOption(idx);
        setPoll({ ...poll, total: data.total, counts: data.counts });
      } else if (data.alreadyVoted) {
        setMyOption(idx);
      } else if (res.status === 401) {
        setError(t("feedPage.pollSignInToVote"));
      } else {
        setError(data.error || "Failed");
      }
    } catch {
      setError("Failed");
    } finally {
      setVoting(false);
    }
  };

  const closingLabel = (() => {
    if (!poll.ends_at) return t("feedPage.pollUnlimited");
    const diff = new Date(poll.ends_at).getTime() - Date.now();
    if (diff <= 0) return t("feedPage.pollUnlimited");
    const days = Math.ceil(diff / 86400000);
    if (days > 1) return t("feedPage.pollClosesIn").replace("{d}", String(days));
    const hours = Math.ceil(diff / 3600000);
    return t("feedPage.pollClosesInHours").replace("{h}", String(hours));
  })();

  return (
    <div className="mt-4 mx-4 md:mx-0 bg-bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="text-[10px] font-bold tracking-wide uppercase text-accent bg-bg-surface px-2 py-0.5 rounded-full">
          {t("feedPage.pollBadge")}
        </span>
        <span className="ml-auto text-[11px] font-medium text-text-secondary">
          {t("feedPage.pollVotes").replace("{n}", String(total))}
        </span>
      </div>

      <div className="p-4">
        <p className="text-[15px] font-bold leading-snug mb-3.5 text-text-primary">
          {question}
        </p>

        <div className="flex flex-col gap-2">
          {options.map((opt, idx) => {
            const isMine = myOption === idx;
            const isWinner = hasVoted && counts[idx] === Math.max(...(counts.length ? counts : [0]));
            const barPct = hasVoted ? pct(counts[idx]) : 0;
            return (
              <button
                key={idx}
                onClick={() => handleVote(idx)}
                disabled={hasVoted || voting}
                className={`relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                  hasVoted
                    ? "border-border bg-bg-primary cursor-default"
                    : "border-border bg-bg-primary hover:border-accent hover:bg-bg-card-hover cursor-pointer"
                }`}
              >
                {/* 결과 막대 (투표 후) */}
                {hasVoted && (
                  <span
                    className="absolute left-0 top-0 bottom-0 bg-accent-light/15 rounded-l-xl"
                    style={{ width: `${barPct}%` }}
                  />
                )}

                {/* 선택 표시 */}
                <span className="relative z-10 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{
                    borderColor: isMine ? "var(--accent)" : "var(--text-secondary)",
                    background: isMine ? "var(--accent)" : "transparent",
                  }}
                >
                  {isMine && (
                    <span
                      className="block w-[8px] h-[4px] border-l-2 border-b-2 border-white -rotate-45 -translate-y-px"
                    />
                  )}
                </span>

                <span className="relative z-10 flex-1 text-[13px] font-medium text-text-primary">
                  {opt}
                </span>

                {hasVoted && (
                  <span className="relative z-10 text-[12px] font-bold text-text-primary">
                    {pct(counts[idx])}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}
      </div>

      <div className="px-4 py-2.5 border-t border-border text-[11px] text-text-secondary flex items-center gap-1.5">
        {hasVoted ? (
          <>
            <span>✓</span> {t("feedPage.pollVoteCounted")} · {closingLabel}
          </>
        ) : (
          closingLabel
        )}
      </div>
    </div>
  );
}
