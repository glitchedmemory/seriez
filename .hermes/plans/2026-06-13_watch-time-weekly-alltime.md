# Watch Time Stats: Weekly + All-Time Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add weekly and all-time watch time statistics to the History page, complementing the existing daily (DayPopup) and monthly (stats.totalHours) views.

**Architecture:** Extend `/api/history` route to compute weekly + all-time aggregations alongside existing monthly stats. Modify `HistoryClient.tsx` to display them in the stats section. No new database tables needed — all data already exists in `episode_watches` + TMDB runtime lookups.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, TMDB API, Tailwind CSS

---

## Current State

| Stat | Source | Status |
|------|--------|--------|
| Daily | `DayPopup.tsx` — sums `runtime × episodeCount` per day | ✅ |
| Weekly | — | ❌ |
| Monthly | `stats.totalHours` in `/api/history` | ✅ |
| All-time | — (only 12-month window queried) | ❌ |

### Current API Behavior

- `/api/history?username=X&month=2026-06`
- Queries `episode_watches` from `graphStart` (12 months back)
- Computes `stats: { totalHours, avgRating, totalTitles, totalEpisodes }` for **target month only**
- `monthlyGraph` shows episode counts per month (no runtime)

### Current UI

- `HistoryClient.tsx` stats section shows `totalHours` as monthly total
- `WatchGraph.tsx` renders 12-month bar chart (episode count, not hours)

---

## Proposed Approach

### API Changes (`app/api/history/route.ts`)

1. **Remove 12-month limit for all-time query** — query all `episode_watches` without `gte("watched_at", graphStart)`
2. **Add `allTimeHours`** — sum `runtime × episodeCount` across all queried watches
3. **Add `weeklyHours`** — group watches by ISO week, compute total for current week
4. **Enrich `monthlyGraph`** — add `hours` field alongside existing `count`

### Frontend Changes (`app/history/HistoryClient.tsx`)

1. **Replace single `totalHours` stat card** with 3 cards: Weekly / Monthly / All-Time
2. **Add `weeklyHours` and `allTimeHours`** to `HistoryData` interface

### No Changes Needed

- `DayPopup.tsx` — daily already works ✅
- `WatchGraph.tsx` — can optionally upgrade to show hours, but out of scope
- Database schema — no changes, all data from existing `episode_watches`

---

## Task Breakdown

### Task 1: Extend API response type

**Objective:** Add `weeklyHours` and `allTimeHours` to the API response shape.

**Files:**
- Modify: `app/api/history/route.ts`

**Step 1: Add weekly + all-time computation**

In the `/api/history` GET handler, after the existing monthly computation (~line 144):

```typescript
// ─── Stats (extended) ───
let totalMin = 0, totalEps = 0;
let allTimeMin = 0;
const titles = new Set<number>();

// Weekly: current ISO week (Monday–Sunday)
const now = new Date();
const dayOfWeek = now.getDay(); // 0=Sun
const monday = new Date(now);
monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
monday.setHours(0, 0, 0, 0);
const sunday = new Date(monday);
sunday.setDate(monday.getDate() + 6);
sunday.setHours(23, 59, 59, 999);
const weekStart = monday.toISOString().split("T")[0];
const weekEnd = sunday.toISOString().split("T")[0];
let weeklyMin = 0;

for (const entries of Object.values(calendar)) for (const e of entries) {
  titles.add(e.tmdbId);
  if (e.runtime) {
    totalMin += e.runtime * e.episodeCount;
  }
  totalEps += e.episodeCount;
}

// All-time: sum all watches (not just target month)
for (const w of (watches || [])) {
  const info = ratingMap.get(w.tmdb_id);
  // We need runtime — already fetched in tmdbMap
  const tmdb = tmdbMap.get(w.tmdb_id);
  const rt = tmdb?.tmdbInfo?.runtime;
  if (rt) allTimeMin += rt;
  
  // Weekly: check if this watch falls in current week
  const watchDate = w.watched_at.slice(0, 10);
  if (watchDate >= weekStart && watchDate <= weekEnd && rt) {
    weeklyMin += rt;
  }
}
```

**Step 2: Add new fields to response JSON**

Change the return statement (~line 183):

```typescript
return NextResponse.json({
  calendar,
  stats: {
    totalHours: Math.round(totalMin / 6) / 10,
    weeklyHours: Math.round(weeklyMin / 6) / 10,
    allTimeHours: Math.round(allTimeMin / 6) / 10,
    avgRating,
    totalTitles: titles.size,
    totalEpisodes: totalEps,
  },
  monthlyGraph,
  topGenres,
  watchList,
});
```

**Verification:** `curl "http://localhost:3000/api/history?username=test&month=2026-06"` should return `weeklyHours`, `allTimeHours` in `stats`.

---

### Task 2: Update HistoryData interface in frontend

**Objective:** Add new stat fields to TypeScript interface.

**Files:**
- Modify: `app/history/HistoryClient.tsx:13-19`

**Step 1: Update interface**

```typescript
interface HistoryData {
  calendar: Record<string, DayEntry[]>;
  stats: {
    totalHours: number;
    weeklyHours: number;
    allTimeHours: number;
    avgRating: number;
    totalTitles: number;
    totalEpisodes: number;
  };
  monthlyGraph: { month: string; count: number }[];
  topGenres: { name: string; avgRating: number; count: number }[];
  watchList: WatchListItem[];
}
```

**Verification:** TypeScript compilation passes (`npm run build`).

---

### Task 3: Insert 3-card watch time row below Monthly Recap divider

**Objective:** Add This Week / This Month / All Time cards between the divider and Taste Profile, no section title.

**Files:**
- Modify: `app/history/HistoryClient.tsx` (between divider and Taste Profile)

**Step 1: Insert after divider, before Taste Profile**

Find this section (~line 147-151):

```tsx
      {/* ── Divider ── */}
      <div className="h-2 bg-[#0a0a14] mb-5" />

      {/* ── Taste Profile ── */}
```

Insert the 3-card row between them:

```tsx
      {/* ── Divider ── */}
      <div className="h-2 bg-[#0a0a14] mb-5" />

      {/* Watch time overview */}
      <div className="px-4 mb-5">
        <div className="grid grid-cols-3 gap-3">
          <StatCard value={`${data.stats.weeklyHours}h`} label="This Week" />
          <StatCard value={`${data.stats.totalHours}h`} label="This Month" />
          <StatCard value={`${data.stats.allTimeHours}h`} label="All Time" />
        </div>
      </div>

      {/* ── Taste Profile ── */}
```

**Step 2: No changes to existing Taste Profile stats row** — the current "Watch Time" card (monthly) inside Taste Profile stays for consistency.

**Verification:** `npm run build` passes. Page renders: divider → 3 time cards → Taste Profile section.

---

### Task 4: Build, commit, deploy

**Step 1:** Local build
```bash
npm run build
```

**Step 2:** Commit
```bash
git add app/api/history/route.ts app/history/HistoryClient.tsx
git commit -m "feat: add weekly and all-time watch time stats"
git push
```

**Step 3:** Deploy to Hetzner
```bash
ssh -i ~/.ssh/hetzner_seriez root@91.99.85.46 \
  "cd /root/seriez && git fetch origin main && git pull origin main \
   && pm2 delete seriez 2>/dev/null; sleep 1; rm -rf .next \
   && npm run build && pm2 start ecosystem.config.js"
```

**Verification:** Visit `https://seriez.app/history` — 3 stat cards visible: This Week / This Month / All Time.

---

## Risks & Tradeoffs

| Risk | Mitigation |
|------|-----------|
| All-time query scans all `episode_watches` rows — slow for heavy users | Acceptable; current user base is small. Can add DB index on `(username, watched_at)` if needed later. |
| `allTimeHours` duplicates runtime lookups already done for monthly | Acceptable memory tradeoff; watch count is bounded. |
| Weekly stat uses client's system clock (server `new Date()`) | This is server-rendered → consistent. Fine. |

## Out of Scope

- Upgrading `WatchGraph` to show hours instead of episode counts
- Weekly trend graph
- Average watch time per day/week
