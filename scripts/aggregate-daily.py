#!/usr/bin/env python3
"""
Daily analytics aggregation script.
Runs via cron to populate analytics.weekly_content_trends and analytics.daily_activity.
"""
import os
import json
import urllib.request
import urllib.error
import urllib.parse
from datetime import date, timedelta, datetime

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def rest_get(table: str, params: dict) -> list:
    """GET from Supabase REST API with query params."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?"
    parts = []
    for k, v in params.items():
        parts.append(f"{k}={urllib.parse.quote(str(v))}")
    url += "&".join(parts)

    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  REST GET {table} error: {e.code}")
        return []


def rest_post(table: str, data: dict) -> bool:
    """POST to Supabase REST API (upsert)."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    body = json.dumps(data).encode()
    headers = {**HEADERS, "Prefer": "resolution=merge-duplicates"}
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status in (200, 201, 204)
    except urllib.error.HTTPError as e:
        print(f"  REST POST {table} error: {e.code} {e.read().decode()[:200]}")
        return False


def aggregate_day(target_date: date):
    """Aggregate one day's data into analytics tables."""
    day_start = target_date.isoformat()
    day_end = (target_date + timedelta(days=1)).isoformat()
    week_start = (target_date - timedelta(days=target_date.weekday())).isoformat()
    today = date.today()

    # Skip future dates
    if target_date >= today:
        print(f"  Skipping {day_start} (today or future)")
        return

    print(f"\n📊 Aggregating {day_start} (week {week_start})")

    # ─── 1. Search counts by content ───
    print("  → search_logs...")
    searches = rest_get("search_logs", {
        "select": "tmdb_id,media_type,query",
        "created_at": f"gte.{day_start}",
        "limit": "10000",
    })
    # Also get the next day's data to filter correctly
    # We just use gte on day_start since cron runs after midnight

    # Count by (tmdb_id, media_type)
    from collections import Counter
    search_counts = Counter()
    for s in searches:
        tid = s.get("tmdb_id")
        mt = s.get("media_type")
        if tid and mt:
            search_counts[(tid, mt)] += 1

    # ─── 2. Visit counts ───
    print("  → content_visits...")
    visits = rest_get("content_visits", {
        "select": "tmdb_id,media_type,country",
        "created_at": f"gte.{day_start}",
        "limit": "10000",
    })
    visit_counts = Counter()
    country_visits = Counter()
    for v in visits:
        tid = v.get("tmdb_id")
        mt = v.get("media_type")
        c = v.get("country", "unknown")
        if tid and mt:
            visit_counts[(tid, mt)] += 1
            country_visits[(tid, mt, c)] += 1

    # ─── 3. Tracking changes ───
    print("  → media_trackings...")
    trackings = rest_get("media_trackings", {
        "select": "tmdb_id,media_type,status",
        "updated_at": f"gte.{day_start}",
        "limit": "10000",
    })
    tracking_adds = Counter()
    tracking_completions = Counter()
    total_tracking_changes = 0
    for t in trackings:
        tid = t.get("tmdb_id")
        mt = t.get("media_type")
        status = t.get("status")
        if tid and mt:
            total_tracking_changes += 1
            if status == "plan_to_watch":
                tracking_adds[(tid, mt)] += 1
            elif status == "completed":
                tracking_completions[(tid, mt)] += 1

    # ─── 4. Reviews ───
    print("  → reviews...")
    reviews = rest_get("reviews", {
        "select": "tmdb_id,media_type,rating",
        "created_at": f"gte.{day_start}",
        "limit": "10000",
    })
    review_counts = Counter()
    rating_sums = {}
    for r in reviews:
        tid = r.get("tmdb_id")
        mt = r.get("media_type")
        rating = r.get("rating", 0)
        if tid and mt:
            review_counts[(tid, mt)] += 1
            key = (tid, mt)
            if key not in rating_sums:
                rating_sums[key] = 0
            rating_sums[key] += (rating or 0)

    # ─── 5. Write to analytics.weekly_content_trends ───
    # Collect all unique (tmdb_id, media_type) combos
    all_keys = set()
    all_keys.update(search_counts.keys())
    all_keys.update(visit_counts.keys())
    all_keys.update(tracking_adds.keys())
    all_keys.update(tracking_completions.keys())
    all_keys.update(review_counts.keys())

    global_results = {}
    for (tid, mt) in all_keys:
        rcount = review_counts.get((tid, mt), 0)
        rsum = rating_sums.get((tid, mt), 0)
        avg_r = round(rsum / rcount, 2) if rcount > 0 else None
        key = f"{week_start}_{tid}_{mt}_all"
        global_results[key] = {
            "week_start": week_start,
            "tmdb_id": tid,
            "media_type": mt,
            "search_count": search_counts.get((tid, mt), 0),
            "visit_count": visit_counts.get((tid, mt), 0),
            "tracking_adds": tracking_adds.get((tid, mt), 0),
            "tracking_completions": tracking_completions.get((tid, mt), 0),
            "avg_rating": avg_r,
            "review_count": rcount,
            "country": "all",
        }

    for (tid, mt) in all_keys:
        for (ctid, cmt, c) in country_visits:
            if ctid == tid and cmt == mt:
                key = f"{week_start}_{tid}_{mt}_{c}"
                if key not in global_results:
                    global_results[key] = {
                        "week_start": week_start,
                        "tmdb_id": tid,
                        "media_type": mt,
                        "search_count": 0,
                        "visit_count": country_visits.get((tid, mt, c), 0),
                        "tracking_adds": 0,
                        "tracking_completions": 0,
                        "avg_rating": None,
                        "review_count": 0,
                        "country": c,
                    }

    upsert_count = 0
    for key, row in global_results.items():
        if row["search_count"] == 0 and row["visit_count"] == 0 and row["tracking_adds"] == 0:
            continue  # skip empty rows
        success = rest_post("analytics.weekly_content_trends", row)
        if success:
            upsert_count += 1
    print(f"  ✅ Wrote {upsert_count} trend rows")

    # ─── 6. Write to analytics.daily_activity ───
    # Count unique users
    unique = set()
    for s in searches:
        u = s.get("username")
        if u:
            unique.add(u)
    for v in visits:
        u = v.get("username")
        if u:
            unique.add(u)

    daily_row = {
        "date": day_start,
        "total_searches": len(searches),
        "total_visits": len(visits),
        "total_tracking_changes": total_tracking_changes,
        "total_reviews": len(reviews),
        "unique_users": len(unique),
    }
    rest_post("analytics.daily_activity", daily_row)
    print(f"  ✅ Wrote daily activity row ({len(searches)} searches, {len(visits)} visits, {len(unique)} users)")


if __name__ == "__main__":
    import sys
    target = date.today() - timedelta(days=1)  # default: yesterday
    if len(sys.argv) > 1:
        target = date.fromisoformat(sys.argv[1])
    aggregate_day(target)
