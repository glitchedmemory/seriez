#!/home/ava/.local/invisible_playwright/bin/python3
"""Scrape streaming Top 10 for Netflix, Disney+, Amazon Prime — Movies + TV Shows.

Data source: JustWatch (justwatch.com/us/provider/{slug}).

JustWatch SSR-embeds an Apollo GraphQL cache (__APOLLO_STATE__) that carries the
provider's "streaming chart" — the platform's own weekly-popularity ranking,
split by objectType (MOVIE = movies, SHOW = tv). Each chart entry exposes a
StreamingChartInfo node with rank / trend / daysInTop10. The root
`streamingCharts(country:US, filter:{category:WEEKLY_POPULARITY_SAME_CONTENT_TYPE,
objectType, packages:[code]}, first:10)` query returns the top 10 titles,
already sorted by popularity. We re-map the list index to rank 1..10 (the
absolute `rank` field is the title's position in the broader US-wide chart, not
its rank inside the top-10 list, so it is NOT used as the output rank).

Each title also carries a TMDB id (tmXXXXX / tsXXXXX) straight from JustWatch,
so tmdbId is resolved without a separate TMDB search; TMDB is only queried for
the poster URL when JustWatch's own poster is unavailable.

Uses the Invisible Playwright venv Python (for the shebang + urllib), no browser
needed — plain HTTP fetch of the SSR HTML.
"""
import os
import re
import sys
import json
import time
from datetime import datetime, timezone
from urllib.request import urlopen, Request
from urllib.parse import quote

# JustWatch provider slug → (output key, package code)
PLATFORM_MAP = {
    "netflix":            {"key": "netflix", "pkg": "nfx"},
    "disney-plus":        {"key": "disney",  "pkg": "dnp"},
    "amazon-prime-video": {"key": "amazon",  "pkg": "amp"},
}
OUTPUT_PATH = "/home/ava/workspace/seriez-2026-06-09/data/streaming-top10.json"
MAX_RETRIES = 3
BASE_DELAY = 10
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")

JW_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def jw_fetch(url):
    """Fetch a URL and return decoded text, or None on failure."""
    req = Request(url, headers={"User-Agent": JW_UA, "Accept-Language": "en-US,en;q=0.9"})
    try:
        with urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", "ignore")
    except Exception as e:
        print(f"  fetch error: {e}", file=sys.stderr)
        return None


def parse_justwatch(html):
    """Parse a single JustWatch provider page's Nuxt devalue payload.

    JustWatch migrated from Next.js/Apollo (`__APOLLO_STATE__`) to Nuxt.js,
    so the SSR data now lives in a `<script id="__NUXT_DATA__">` tag holding a
    devalue-encoded reference array. Every dict/list value that is an int is a
    single index into that top-level array; deref once to resolve it.

    Returns {"movies": [...], "tv": [...]} for the provider in that page,
    or None if the page has no usable data.
    """
    m = re.search(r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
    except Exception:
        return None

    # data[4] is the Apollo cache (keys like "ROOT_QUERY", "Show:ts...", "Movie:tm...")
    try:
        cache = data[4]
    except (IndexError, TypeError):
        return None
    if not isinstance(cache, dict) or "ROOT_QUERY" not in cache:
        return None

    def d(v):
        """Single index deref: int -> data[int], else pass through."""
        if isinstance(v, int) and 0 <= v < len(data):
            return data[v]
        return v

    result = {"movies": [], "tv": []}

    for objtype, cat in (("MOVIE", "movies"), ("SHOW", "tv")):
        rqnode = d(cache.get("ROOT_QUERY"))
        if not isinstance(rqnode, dict):
            continue
        key = None
        for k in rqnode:
            if isinstance(k, str) and "streamingCharts" in k and '"objectType":"%s"' % objtype in k:
                key = k
                break
        if key is None:
            continue
        chart = d(rqnode[key])
        if not isinstance(chart, dict) or "edges" not in chart:
            continue
        edges = d(chart["edges"])
        if not isinstance(edges, list):
            continue

        items = []
        for eidx in edges:
            edge = d(eidx)
            if not isinstance(edge, dict):
                continue
            info = d(edge.get("streamingChartInfo"))
            rank = d(info.get("rank")) if isinstance(info, dict) else None
            node = d(edge.get("node"))
            ref = d(node.get("__ref")) if isinstance(node, dict) else None
            title = None
            if ref:
                nd = d(cache.get(ref))
                if isinstance(nd, dict):
                    for ck, cv in nd.items():
                        if isinstance(ck, str) and ck.startswith("content("):
                            cd = d(cv)
                            if isinstance(cd, dict):
                                title = d(cd.get("title"))
                            break
            if title:
                items.append({
                    "title": title,
                    "mediaType": "movie" if objtype == "MOVIE" else "tv",
                    "_chartRank": rank if isinstance(rank, int) else 0,
                })

        # edges arrive sorted by popularity — assign 1..10 in that order
        items = items[:10]
        for i, it in enumerate(items):
            it["rank"] = i + 1
            cr = it.pop("_chartRank", None)
            it["score"] = cr if isinstance(cr, int) else 0
        result[cat] = items

    return result


def is_valid(output):
    """All 3 platforms must have 9-10 movies AND 9-10 TV shows."""
    for cfg in PLATFORM_MAP.values():
        key = cfg["key"]
        for cat in ("movies", "tv"):
            n = len(output.get(key, {}).get(cat, []))
            if not (9 <= n <= 10):
                return False
    return True


def tmdb_request(path, params=None):
    """Call TMDB API. Returns parsed JSON or None on failure."""
    if not TMDB_API_KEY:
        return None
    qs = f"api_key={TMDB_API_KEY}"
    if params:
        for k, v in params.items():
            qs += f"&{k}={quote(str(v))}"
    url = f"https://api.themoviedb.org/3{path}?{qs}"
    req = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    try:
        with urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  TMDB API error: {e}", file=sys.stderr)
        return None


def find_tmdb(title, media_type):
    """Search TMDB by title (JustWatch's tmXXXXX id is NOT a TMDB id, so we
    must match by title). Returns (tmdbId, mediaType, posterPath, officialTitle)
    or (None, None, None, None). officialTitle is the TMDB canonical name, used
    to normalize JustWatch's noisy titles (e.g. "Ready or Not 2: Here I Come"
    -> "Ready or Not: Here I Come")."""
    title_lower = title.strip().lower()
    if media_type == "movie":
        result = tmdb_request("/search/movie", {"query": title, "language": "en-US", "page": 1})
        results_key = "results"
    else:
        result = tmdb_request("/search/tv", {"query": title, "language": "en-US", "page": 1})
        results_key = "results"

    if not result or not result.get(results_key):
        return None, None, None, None

    candidates = result[results_key]
    if not candidates:
        return None, None, None, None

    # Match: exact, then starts-with/contains, then first result
    best = None
    for item in candidates:
        item_title = (item.get("title") or item.get("name") or "").strip().lower()
        if item_title == title_lower:
            best = item
            break
    if not best:
        for item in candidates:
            item_title = (item.get("title") or item.get("name") or "").strip().lower()
            if item_title.startswith(title_lower) or title_lower.startswith(item_title):
                best = item
                break
    if not best:
        best = candidates[0]

    tmdb_id = best["id"]
    resolved_type = "movie" if best.get("title") else "tv"
    official_title = best.get("title") or best.get("name") or title
    return tmdb_id, resolved_type, best.get("poster_path"), official_title


def enrich_posters(output):
    """Match every title to TMDB by name and set its TMDB poster + tmdbId.

    JustWatch's `id` field (tmXXXXX / tsXXXXX) is a JustWatch-internal id, NOT a
    TMDB id — so tmdbId must be resolved by TMDB title search. Posters are
    always served from image.tmdb.org (no Cloudflare block).

    NOTE (2026-09-09): the old (title, mediaType)-keyed cache that reused the
    previous run's tmdbId was removed. A bad match from an earlier run corrupted
    the cache and propagated wrong tmdbIds forever (e.g. Reacher->314375, a
    totally different show). Always re-query TMDB so corrupted entries can't
    survive. 60 items * ~0.3s is well within TMDB's 40 req/s rate limit.
    """
    total = sum(len(output[cfg["key"]][c]) for cfg in PLATFORM_MAP.values() for c in ("movies", "tv"))
    print(f"\nResolving TMDB ids + posters for {total} items...")

    filled = unmatched = 0
    for cfg in PLATFORM_MAP.values():
        for cat in ("movies", "tv"):
            for item in output[cfg["key"]][cat]:
                title = item["title"]
                mt = "movie" if cat == "movies" else "tv"
                tmdb_id, resolved_type, poster_path, official_title = find_tmdb(title, mt)
                if tmdb_id:
                    item["tmdbId"] = tmdb_id
                    item["mediaType"] = resolved_type
                    # Normalize noisy JustWatch titles to the TMDB canonical name
                    # (e.g. "Ready or Not 2: Here I Come" -> "Ready or Not: Here I Come")
                    if official_title:
                        item["title"] = official_title
                    if poster_path:
                        item["poster"] = f"https://image.tmdb.org/t/p/w342{poster_path}"
                    else:
                        item["poster"] = None
                    filled += 1
                else:
                    item["tmdbId"] = None
                    item["mediaType"] = mt
                    item["poster"] = None
                    unmatched += 1
                time.sleep(0.3)

    print(f"  Matched {filled} via TMDB search; unmatched {unmatched}")


def main():
    output = None
    for attempt in range(1, MAX_RETRIES + 1):
        print(f"Attempt {attempt}/{MAX_RETRIES}...")
        all_pages = {}
        for slug in PLATFORM_MAP:
            html = jw_fetch(f"https://www.justwatch.com/us/provider/{slug}")
            if html is None:
                all_pages[slug] = None
            else:
                all_pages[slug] = html

        # Parse each platform independently and merge
        merged = {cfg["key"]: {"movies": [], "tv": []} for cfg in PLATFORM_MAP.values()}
        ok = True
        for slug, html in all_pages.items():
            if html is None:
                ok = False
                continue
            parsed = parse_justwatch(html)
            if parsed is None:
                ok = False
                continue
            key = PLATFORM_MAP[slug]["key"]
            merged[key] = parsed

        if ok:
            output = merged
            break

        if attempt < MAX_RETRIES:
            delay = BASE_DELAY * (2 ** (attempt - 1))
            print(f"  Invalid results, retrying in {delay}s...", file=sys.stderr)
            time.sleep(delay)

    if output is None or not is_valid(output):
        print(f"\nFAILED after {MAX_RETRIES} attempts", file=sys.stderr)
        sys.exit(1)

    # Verify each platform's counts
    for key in ("netflix", "disney", "amazon"):
        for cat in ("movies", "tv"):
            n = len(output[key][cat])
            print(f"  {key}/{cat}: {n} items")

    enrich_posters(output)

    with open(OUTPUT_PATH, "w") as f:
        json.dump({
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "data": output,
            "source": "justwatch",
        }, f, indent=2)
    print(f"\nSaved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
