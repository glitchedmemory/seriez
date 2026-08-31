"use client";

import { useState, useEffect, useCallback } from "react";

interface PopularItem {
  tmdb_id: number;
  media_type: string;
  title: string;
  poster: string | null;
  count: number;
  avg_rating?: number | null;
}

interface SearchAnalytics {
  top_queries: { query: string; count: number }[];
  daily_volume: { date: string; count: number }[];
  total_searches: number;
}

interface ActivityAnalytics {
  dau: { date: string; count: number }[];
  most_active: { username: string; count: number }[];
  signup_trend: { date: string; count: number }[];
}

function fmtShortDate(iso: string) {
  const d = new Date(iso);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${m[d.getMonth()]} ${d.getDate()}`;
}

export default function AnalyticsPage() {
  const [search, setSearch] = useState<SearchAnalytics | null>(null);
  const [popular, setPopular] = useState<{
    most_tracked: PopularItem[];
    most_reviewed: PopularItem[];
    most_collected: PopularItem[];
  } | null>(null);
  const [activity, setActivity] = useState<ActivityAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, a] = await Promise.all([
        fetch("/api/admin/search-analytics").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/admin/popular-content").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/admin/user-activity").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (s) setSearch(s);
      if (p) setPopular(p);
      if (a) setActivity(a);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-sm text-[#71717a] mt-1">
            Search trends, popular titles, and user activity
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#1a1a2e] text-[#71717a] hover:text-white hover:border-[#2a2a45] transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[#71717a]">Loading analytics...</p>
      ) : (
        <div className="space-y-6">
          {/* Top queries */}
          <section className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Top Searches</h2>
              <span className="text-xs text-[#71717a]">
                {search?.total_searches ?? 0} searches · 30 days
              </span>
            </div>
            {!search || search.top_queries.length === 0 ? (
              <p className="text-sm text-[#71717a]">No search data yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {search.top_queries.slice(0, 30).map((q) => (
                  <span
                    key={q.query}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-[#1a1a2e] bg-[#111118] text-[#d4d4d8]"
                  >
                    {q.query}
                    <span className="text-[#6366f1] font-medium">{q.count}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Popular content */}
          <section className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Most Popular Content</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <PopularColumn label="Most Tracked" items={popular?.most_tracked ?? []} />
              <PopularColumn label="Most Reviewed" items={popular?.most_reviewed ?? []} showRating />
              <PopularColumn label="Most Collected" items={popular?.most_collected ?? []} />
            </div>
          </section>

          {/* User activity */}
          <section className="rounded-2xl border border-[#1a1a2e] bg-[#0a0a14] p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-sm font-semibold text-white mb-4">Daily Active Users</h2>
                {!activity || activity.dau.length === 0 ? (
                  <p className="text-sm text-[#71717a]">No activity data yet.</p>
                ) : (
                  <BarChart rows={activity.dau.slice(-14)} />
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white mb-4">Most Active Users · 7 days</h2>
                {!activity || activity.most_active.length === 0 ? (
                  <p className="text-sm text-[#71717a]">No user activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {activity.most_active.slice(0, 10).map((u) => (
                      <div key={u.username} className="flex items-center justify-between">
                        <span className="text-sm text-[#d4d4d8]">{u.username}</span>
                        <span className="text-xs text-[#71717a]">{u.count} actions</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PopularColumn({
  label,
  items,
  showRating,
}: {
  label: string;
  items: PopularItem[];
  showRating?: boolean;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider mb-3">{label}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[#71717a]">No data yet.</p>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 10).map((item) => (
            <div key={`${item.media_type}-${item.tmdb_id}`} className="flex items-center gap-3">
              <span className="text-xs text-[#52525b] w-5 shrink-0 text-right font-medium">
                {item.count}
              </span>
              {item.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-8 h-12 rounded object-cover shrink-0 bg-[#111118]"
                />
              ) : (
                <div className="w-8 h-12 rounded bg-[#111118] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#d4d4d8] truncate">{item.title}</p>
                <p className="text-[10px] text-[#52525b] uppercase">
                  {item.media_type}
                  {showRating && item.avg_rating ? ` · ★ ${item.avg_rating}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BarChart({ rows }: { rows: { date: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex items-end gap-1.5 h-32">
      {rows.map((r) => (
        <div key={r.date} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-[#6366f1]/60 hover:bg-[#6366f1] transition-colors"
            style={{ height: `${Math.max(2, (r.count / max) * 100)}%` }}
            title={`${fmtShortDate(r.date)}: ${r.count}`}
          />
        </div>
      ))}
    </div>
  );
}
