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
    """Parse a single JustWatch provider page's Apollo state.

    Returns {"movies": [...], "tv": [...]} for the provider in that single page,
    or None if the page has no usable data.
    """
    m = re.search(r'__APOLLO_STATE__\s*=\s*(\{.*?\})\s*;?\s*</script>', html, re.DOTALL)
    if not m:
        return None
    try:
        state = json.loads(m.group(1))
    except Exception:
        return None
    default = state.get("defaultClient", state)

    result = {"movies": [], "tv": []}

    for objtype, cat in (("MOVIE", "movies"), ("SHOW", "tv")):
        # Locate the root streamingCharts query for this page's package + objectType
        root_key = None
        for k in default.keys():
            if not isinstance(k, str):
                continue
            if ("streamingCharts" not in k) or ("ROOT_QUERY" not in k):
                continue
            if '"objectType":"%s"' % objtype in k:
                root_key = k
                break
        if root_key is None:
            continue

        conn = default.get(root_key, {})
        edge_refs = conn.get("edges", [])
        items = []
        for er in edge_refs:
            if not isinstance(er, dict):
                continue
            edge = default.get(er.get("id"), {})

            # resolve node object id (tmXXXXX / tsXXXXX) for tmdbId
            node = edge.get("node", {})
            objid = None
            otype = None
            if isinstance(node, dict):
                nid = node.get("id")
                if nid and nid in default:
                    node_data = default[nid]
                    objid = node_data.get("id")
                    otype = node_data.get("__typename")

            # resolve title from the content node (poster is fetched via TMDB later)
            title = None
            if objid:
                for ck, cv in default.items():
                    if isinstance(cv, dict) and cv.get("__typename") in ("MovieContent", "ShowContent"):
                        if objid in ck:
                            title = cv.get("title")
                            break

            if title:
                items.append({
                    "title": title,
                    "mediaType": "movie" if otype == "Movie" else "tv",
                })
                # resolve rank (absolute chart position; NOT used as output rank)
                sci = edge.get("streamingChartInfo", {})
                if isinstance(sci, dict):
                    sid = sci.get("id")
                    if sid and sid in default:
                        rank = default[sid].get("rank")
                        if rank is not None:
                            items[-1]["_chartRank"] = rank

        # edges arrive sorted by popularity — assign 1..10 in that order
        items = items[:10]
        for i, it in enumerate(items):
            it["rank"] = i + 1
            # score = absolute chart position (trend/popularity signal); keep the
            # field for schema compatibility with the old FlixPatrol output.
            cr = it.pop("_chartRank", None)
            it["score"] = cr if cr is not None else 0
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
    must match by title). Returns (tmdbId, mediaType, posterPath) or (None...)."""
    title_lower = title.strip().lower()
    if media_type == "movie":
        result = tmdb_request("/search/movie", {"query": title, "language": "en-US", "page": 1})
        results_key = "results"
    else:
        result = tmdb_request("/search/tv", {"query": title, "language": "en-US", "page": 1})
        results_key = "results"

    if not result or not result.get(results_key):
        return None, None, None

    candidates = result[results_key]
    if not candidates:
        return None, None, None

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
    return tmdb_id, resolved_type, best.get("poster_path")


def enrich_posters(output):
    """Match every title to TMDB by name and set its TMDB poster + tmdbId.

    JustWatch's `id` field (tmXXXXX / tsXXXXX) is a JustWatch-internal id, NOT a
    TMDB id — so tmdbId must be resolved by TMDB title search. Posters are
    always served from image.tmdb.org (no Cloudflare block). Cached results
    from the previous run are reused by (title_lower, mediaType).
    """
    total = sum(len(output[cfg["key"]][c]) for cfg in PLATFORM_MAP.values() for c in ("movies", "tv"))
    print(f"\nResolving TMDB ids + posters for {total} items...")

    existing = {}
    if os.path.exists(OUTPUT_PATH):
        try:
            with open(OUTPUT_PATH, "r") as f:
                prev = json.load(f)
            for plat in prev.get("data", {}).values():
                for cat in ("movies", "tv"):
                    for it in plat.get(cat, []):
                        p = it.get("poster") or ""
                        if p.startswith("https://image.tmdb.org") and it.get("tmdbId") and it.get("title"):
                            existing[(it["title"].strip().lower(), it.get("mediaType"))] = (it["tmdbId"], p)
            if existing:
                print(f"  Loaded {len(existing)} cached TMDB entries")
        except Exception:
            pass

    filled = reused = unmatched = 0
    for cfg in PLATFORM_MAP.values():
        for cat in ("movies", "tv"):
            for item in output[cfg["key"]][cat]:
                title = item["title"]
                mt = "movie" if cat == "movies" else "tv"
                key = (title.strip().lower(), mt)
                if key in existing:
                    item["tmdbId"], item["poster"] = existing[key]
                    item["mediaType"] = mt
                    reused += 1
                    continue
                tmdb_id, resolved_type, poster_path = find_tmdb(title, mt)
                if tmdb_id:
                    item["tmdbId"] = tmdb_id
                    item["mediaType"] = resolved_type
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

    print(f"  Matched {filled} via TMDB search; reused {reused} cached; unmatched {unmatched}")


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
