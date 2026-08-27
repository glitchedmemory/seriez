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
  myOption: number | null;
}

export default function PollCard() {
  const t = useTranslations();
  const locale = useLocale();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selected, setSelected] = useState<number | null>(null); // 확인 전 임시 선택
  const [myOption, setMyOption] = useState<number | null>(null); // 확정된 투표
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/polls")
      .then((r) => r.json())
      .then((data) => {
        if (data.polls && data.polls.length) {
          const p = data.polls[0];
          setPoll(p);
          // 이미 투표한 유저면 결과를 바로 보여줌 (재투표 UI 숨김)
          if (typeof p.myOption === "number") {
            setMyOption(p.myOption);
          }
        }
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

  const hasVoted = myOption !== null;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // 선택지 클릭 → 임시 선택만 (투표 아직 안 됨)
  const handleSelect = (idx: number) => {
    if (hasVoted || voting) return;
    setSelected(idx);
  };

  // 확인 버튼 클릭 → 그때서야 투표
  const handleConfirm = async () => {
    if (selected === null || hasVoted || voting) return;
    setVoting(true);
    setError(null);
    try {
      const res = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, optionIndex: selected }),
      });
      const data = await res.json();
      if (res.ok) {
        setMyOption(selected);
        setPoll({ ...poll, total: data.total, counts: data.counts });
      } else if (data.alreadyVoted) {
        setMyOption(selected);
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
    if (!poll.ends_at) return ""; // 무기한 → 마감 표시 없음
    const diff = new Date(poll.ends_at).getTime() - Date.now();
    if (diff <= 0) return "";
    const days = Math.ceil(diff / 86400000);
    if (days > 1) return t("feedPage.pollClosesIn", { d: days });
    const hours = Math.ceil(diff / 3600000);
    return t("feedPage.pollClosesInHours", { h: hours });
  })();

  return (
    <>
      {/* 섹션 헤딩 */}
      <div className="flex items-center gap-2 px-4 pt-5 pb-2.5 md:px-0">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
        <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-text-secondary">
          {t("feedPage.pollBadge")}
        </span>
      </div>

      <div className="mx-4 md:mx-0 bg-bg-card border border-border rounded-[20px] overflow-hidden">
        <div className="flex items-center gap-2.5 px-[18px] pt-4 pb-3">
          <span className="text-[10px] font-bold tracking-[0.06em] text-accent-light bg-accent-light/15 px-2.5 py-1 rounded-full">
            {t("feedPage.pollBadge")}
          </span>
          <span className="ml-auto text-[12px] text-text-secondary">
            {t("feedPage.pollVotes", { n: total })}
          </span>
        </div>

        <p className="px-[18px] pb-3.5 text-[17px] font-bold tracking-[-0.01em] leading-snug text-text-primary">
          {question}
        </p>

        <div className="px-3.5 pb-2 flex flex-col gap-2">
          {options.map((opt, idx) => {
            const isSelected = selected === idx;
            const isMine = hasVoted && myOption === idx;
            const barPct = hasVoted ? pct(counts[idx]) : 0;
            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                disabled={hasVoted || voting}
                className={`relative flex items-center gap-2.5 px-3.5 py-3 rounded-[14px] border text-left overflow-hidden transition-[border-color,background] duration-150 ${
                  hasVoted
                    ? "border-border bg-bg-primary cursor-default"
                    : (isSelected
                        ? "border-accent bg-accent/10"
                        : "border-border bg-bg-primary hover:border-accent cursor-pointer")
                }`}
              >
                {/* 결과 막대 (투표 후) */}
                {hasVoted && (
                  <span
                    className="absolute left-0 top-0 bottom-0 bg-accent-light/15"
                    style={{ width: `${barPct}%`, transition: "width .5s cubic-bezier(.22,1,.36,1)" }}
                  />
                )}

                {/* 라디오 체크 */}
                <span
                  className={`relative z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-[border-color,background] duration-150 ${
                    (isSelected || isMine) ? "border-accent bg-accent" : "border-text-secondary"
                  }`}
                >
                  {(isSelected || isMine) && (
                    <span className="block w-1.5 h-2.5 border-r-2 border-b-2 border-white rotate-45 -translate-y-px" />
                  )}
                </span>

                <span className="relative z-10 flex-1 text-[14px] font-medium text-text-primary">
                  {opt}
                </span>

                {hasVoted && (
                  <span className="relative z-10 text-[13px] font-bold text-text-primary tabular-nums">
                    {pct(counts[idx])}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-2 px-[18px] text-[12px] text-red-500">{error}</p>}

        {/* 투표 버튼 — 투표 전에만 */}
        {!hasVoted && (
          <div className="px-3.5 pb-3.5">
            <button
              onClick={handleConfirm}
              disabled={selected === null || voting}
              className={`w-full rounded-[13px] py-3 text-sm font-bold transition-opacity ${
                selected !== null && !voting
                  ? "bg-accent text-white hover:opacity-90"
                  : "bg-bg-surface text-text-secondary cursor-not-allowed"
              }`}
            >
              {voting ? "..." : t("feedPage.pollConfirm")}
            </button>
          </div>
        )}

        {/* 하단 상태 */}
        {(hasVoted || closingLabel) && (
          <div className="px-[18px] py-2.5 border-t border-border text-[12px] text-text-secondary flex items-center gap-1.5">
            {hasVoted && (
              <>
                <span className="text-[#22c55e] font-bold">✓</span>
                <span>{t("feedPage.pollVoteCounted")}</span>
                {closingLabel && <span>· {closingLabel}</span>}
              </>
            )}
            {!hasVoted && closingLabel && <span>{closingLabel}</span>}
          </div>
        )}
      </div>
    </>
  );
}
