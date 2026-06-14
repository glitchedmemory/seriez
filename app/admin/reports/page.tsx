"use client";

import { useState, useEffect } from "react";

interface HiddenItem {
  type: "review" | "comment";
  id: string | number;
  username: string;
  content: string;
  ai_verdict?: string;
  created_at: string;
  tmdb_id?: number;
  media_type?: string;
  review_id?: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function AdminReportsPage() {
  const [items, setItems] = useState<HiddenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [verdicts, setVerdicts] = useState<Record<string, string>>({});
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        const data = await res.json();
        const all: HiddenItem[] = [
          ...(data.reviews || []).map((r: any) => ({ ...r, type: "review" as const })),
          ...(data.comments || []).map((c: any) => ({ ...c, type: "comment" as const })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setItems(all);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAction = async (item: HiddenItem, action: "restore" | "delete") => {
    const targetId = String(item.id);
    const res = await fetch(`/api/admin/reports?action=${action}&target_type=${item.type}&target_id=${targetId}`);
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id || i.type !== item.type));
    }
  };

  const handleAnalyze = async (item: HiddenItem) => {
    const key = `${item.type}-${item.id}`;
    setAnalyzingId(key);
    try {
      const res = await fetch("/api/admin/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: item.content, target_type: item.type, target_id: String(item.id) }),
      });
      if (res.ok) {
        const data = await res.json();
        setVerdicts((prev) => ({ ...prev, [key]: data.verdict }));
      }
    } catch {}
    setAnalyzingId(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-text-primary p-6">
      <h1 className="text-2xl font-bold mb-6">🚨 Hidden Content Reports</h1>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-text-secondary">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-text-secondary">No hidden content. Clean! ✅</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const key = `${item.type}-${item.id}`;
            const verdict = verdicts[key] || item.ai_verdict;
            return (
              <div key={key} className="bg-bg-card rounded-xl p-4 border border-red-800/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded">
                      {item.type === "review" ? "📝 Review" : "💬 Comment"}
                    </span>
                    <span className="text-xs text-text-secondary">{item.username}</span>
                    <span className="text-xs text-text-secondary">{formatDate(item.created_at)}</span>
                    {(item as any).report_count >= 5 && (
                      <span className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full font-bold">
                        🚩 {(item as any).report_count}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAnalyze(item)}
                      disabled={analyzingId === key}
                      className="text-xs px-2 py-1 bg-blue-600/30 text-blue-300 rounded hover:bg-blue-600/50 disabled:opacity-50"
                    >
                      {analyzingId === key ? "Analyzing..." : "🔍 Analyze"}
                    </button>
                    <button
                      onClick={() => handleAction(item, "restore")}
                      className="text-xs px-2 py-1 bg-green-600/30 text-green-300 rounded hover:bg-green-600/50"
                    >
                      ✅ Restore
                    </button>
                    <button
                      onClick={() => handleAction(item, "delete")}
                      className="text-xs px-2 py-1 bg-red-600/30 text-red-300 rounded hover:bg-red-600/50"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
                <p className="text-sm text-[#d1d5db] light:text-text-primary bg-bg-surface p-3 rounded-lg whitespace-pre-wrap">
                  {item.content}
                </p>
                {verdict && (
                  <div className={`mt-2 text-xs p-2 rounded ${
                    verdict.includes("삭제") || verdict.includes("DELETE")
                      ? "bg-red-900/30 text-red-300"
                      : verdict.includes("복구") || verdict.includes("RESTORE")
                      ? "bg-green-900/30 text-green-300"
                      : "bg-yellow-900/30 text-yellow-300"
                  }`}>
                    🤖 {verdict}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
