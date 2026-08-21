"use client";

import { useState, useEffect, useCallback } from "react";

interface HistPoll {
  id: string;
  question: Record<string, string>;
  options: Record<string, string[]>;
  closed_at: string;
  total: number;
  counts: number[];
}

export default function AdminPollsPage() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [sourceLocale, setSourceLocale] = useState("ko");
  const [endsDays, setEndsDays] = useState<string>(""); // "" = 무기한
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [active, setActive] = useState<any[]>([]);
  const [history, setHistory] = useState<HistPoll[]>([]);

  const loadHistory = useCallback(() => {
    fetch("/api/polls/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.polls || []))
      .catch(() => {});
  }, []);

  const loadActive = useCallback(() => {
    fetch("/api/polls")
      .then((r) => r.json())
      .then((d) => setActive(d.polls || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadActive();
    loadHistory();
  }, [loadActive, loadHistory]);

  const addOption = () => setOptions([...options, ""]);
  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  };
  const setOption = (i: number, v: string) => {
    const next = [...options];
    next[i] = v;
    setOptions(next);
  };

  const handleCreate = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) {
      setMsg("질문과 선택지 2개 이상을 입력하세요.");
      return;
    }
    setCreating(true);
    setMsg(null);

    let endsAt: string | null = null;
    if (endsDays && Number(endsDays) > 0) {
      endsAt = new Date(Date.now() + Number(endsDays) * 86400000).toISOString();
    }

    try {
      const res = await fetch("/api/polls/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          options: cleanOptions,
          sourceLocale,
          endsAt,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("✓ 투표 생성 완료 (다국어 번역 포함)");
        setQuestion("");
        setOptions(["", ""]);
        setEndsDays("");
        loadActive();
      } else {
        setMsg("❌ " + (data.error || "생성 실패"));
      }
    } catch {
      setMsg("❌ 네트워크 오류");
    } finally {
      setCreating(false);
    }
  };

  const handleClose = async (pollId: string) => {
    const res = await fetch("/api/polls/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId }),
    });
    if (res.ok) {
      loadActive();
      loadHistory();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">투표 관리 (Polls)</h1>

      {/* 생성 폼 */}
      <section className="bg-[#12121f] border border-[#1a1a2e] rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-[#a1a1aa] mb-4">새 투표 만들기</h2>

        <label className="block text-xs text-[#71717a] mb-1">질문</label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full bg-[#0a0a14] border border-[#1a1a2e] rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-[#6366f1]"
          placeholder="예: 영화는 극장에서 봐야 제맛이다 vs 스트리밍이다"
        />

        <label className="block text-xs text-[#71717a] mb-1">선택지</label>
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              className="flex-1 bg-[#0a0a14] border border-[#1a1a2e] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1]"
              placeholder={`선택지 ${i + 1}`}
            />
            <button
              onClick={() => removeOption(i)}
              className="px-2 text-[#71717a] hover:text-[#ef4444] text-xs"
              disabled={options.length <= 2}
            >
              ✕
            </button>
          </div>
        ))}
        <button onClick={addOption} className="text-xs text-[#6366f1] hover:text-[#a5b4fc] mb-4">
          + 선택지 추가
        </button>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-[#71717a] mb-1">원문 언어</label>
            <select
              value={sourceLocale}
              onChange={(e) => setSourceLocale(e.target.value)}
              className="w-full bg-[#0a0a14] border border-[#1a1a2e] rounded-lg px-3 py-2 text-sm"
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="es">Español</option>
              <option value="pt">Português</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#71717a] mb-1">투표 기간 (일, 비우면 무기한)</label>
            <input
              value={endsDays}
              onChange={(e) => setEndsDays(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full bg-[#0a0a14] border border-[#1a1a2e] rounded-lg px-3 py-2 text-sm"
              placeholder="예: 3 (3일 후 자동 종료)"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-50 rounded-lg py-2.5 text-sm font-semibold transition-colors"
        >
          {creating ? "생성 중 (번역 포함)..." : "투표 생성"}
        </button>
        {msg && <p className="mt-3 text-sm text-[#a5b4fc]">{msg}</p>}
      </section>

      {/* 진행 중 */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[#a1a1aa] mb-3">진행 중인 투표</h2>
        {active.length === 0 ? (
          <p className="text-sm text-[#71717a]">진행 중인 투표가 없습니다.</p>
        ) : (
          active.map((p) => (
            <div key={p.id} className="bg-[#12121f] border border-[#1a1a2e] rounded-lg p-4 mb-3">
              <p className="text-sm font-semibold mb-2">{p.question?.en || p.question?.ko || ""}</p>
              <p className="text-xs text-[#71717a] mb-3">
                총 {p.total}표 · 종료: {p.ends_at ? new Date(p.ends_at).toLocaleDateString() : "무기한"}
              </p>
              <button
                onClick={() => handleClose(p.id)}
                className="bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/25 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              >
                투표 종료
              </button>
            </div>
          ))
        )}
      </section>

      {/* 히스토리 */}
      <section>
        <h2 className="text-sm font-semibold text-[#a1a1aa] mb-3">종료된 투표 히스토리</h2>
        {history.length === 0 ? (
          <p className="text-sm text-[#71717a]">히스토리가 없습니다.</p>
        ) : (
          history.map((p) => {
            const options = p.options?.en || [];
            return (
              <div key={p.id} className="bg-[#12121f] border border-[#1a1a2e] rounded-lg p-4 mb-3">
                <p className="text-sm font-semibold mb-2">
                  {p.question?.en || p.question?.ko || ""}
                </p>
                <div className="space-y-1 mb-2">
                  {options.map((opt, i) => {
                    const pct = p.total > 0 ? Math.round(((p.counts?.[i] || 0) / p.total) * 100) : 0;
                    return (
                      <div key={i} className="text-xs text-[#a1a1aa] flex items-center gap-2">
                        <span className="flex-1">{opt}</span>
                        <span className="text-[#71717a]">{p.counts?.[i] || 0}표</span>
                        <span className="w-10 text-right font-semibold text-[#a5b4fc]">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#71717a]">
                  종료: {new Date(p.closed_at).toLocaleDateString()} · 총 {p.total}표
                </p>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
