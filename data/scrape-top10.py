#!/home/ava/.local/invisible_playwright/bin/python3
"""Scrape FlixPatrol Top 10 for Netflix, Disney+, Amazon Prime — Movies + TV Shows + Posters.
Uses Invisible Playwright to extract both text rankings and poster images.
With retry logic: up to 3 attempts with exponential backoff."""
import re
import sys
import time
import json
from datetime import datetime, timezone

FLIXPATROL_BASE = "https://flixpatrol.com"
PLATFORM_MAP = {"Netflix": "netflix", "Disney+": "disney", "Amazon Prime": "amazon"}
OUTPUT_PATH = "/home/ava/workspace/seriez-2026-06-09/data/streaming-top10.json"
MAX_RETRIES = 3
BASE_DELAY = 10

HEADER_RE = re.compile(r'TOP (Movies|TV Shows) on (.+?) on \w+ \d+, \d+')
ITEM_RE = re.compile(r'^(\d+)\.\t\n(.+?)\n\t(\d+)', re.MULTILINE)
IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"[^>]*>')


def fetch_page():
    """Fetch FlixPatrol via Invisible Playwright. Returns (inner_text, html) or (None, None)."""
    try:
        from invisible_playwright import InvisiblePlaywright

        with InvisiblePlaywright(headless=True) as browser:
            page = browser.new_page()
            page.goto("https://flixpatrol.com/top10/", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(5000)  # Wait for images to load
            text = page.inner_text("body")
            html = page.content()
            return text, html
    except Exception as e:
        print(f"Playwright error: {e}", file=sys.stderr)
        return None, None


def parse_items(text, html):
    """Parse streaming top 10 items with posters from FlixPatrol."""
    headers = [(m.start(), m.group(1), m.group(2)) for m in HEADER_RE.finditer(text)]

    output = {}
    for key in PLATFORM_MAP.values():
        output[key] = {"movies": [], "tv": []}

    for i, (pos, media_type, platform) in enumerate(headers):
        key = PLATFORM_MAP.get(platform)
        if key is None:
            continue

        category = "movies" if media_type == "Movies" else "tv"
        end_pos = headers[i + 1][0] if i + 1 < len(headers) else len(text)
        section_text = text[pos:end_pos]

        # Find corresponding section in HTML for image extraction
        header_text = f"TOP {media_type} on {platform}"
        html_start = html.find(header_text)
        if html_start >= 0 and i + 1 < len(headers):
            nh_media, nh_platform = headers[i + 1][1], headers[i + 1][2]
            nh_text = f"TOP {nh_media} on {nh_platform}"
            html_end = html.find(nh_text, html_start + 100)
            if html_end < 0:
                html_end = len(html)
        elif html_start >= 0:
            html_end = len(html)
        else:
            html_end = 0

        section_html = html[html_start:html_end] if html_end > html_start else ""
        section_imgs = IMG_RE.findall(section_html)
        poster_urls = [f"{FLIXPATROL_BASE}{u}" for u in section_imgs if '/posters/' in u]

        # Parse text items
        items = []
        for m in ITEM_RE.finditer(section_text):
            rank = int(m.group(1))
            title = m.group(2).strip()
            score = int(m.group(3))
            if rank <= 10:
                poster = poster_urls[rank - 1] if rank - 1 < len(poster_urls) else None
                items.append({
                    "rank": rank,
                    "title": title,
                    "score": score,
                    "poster": poster,
                })

        output[key][category] = items
        poster_count = sum(1 for it in items if it.get("poster"))
        print(f"  {key}/{category}: {len(items)} items, {poster_count} posters")

    return output


def is_valid(output):
    """Check if all 3 platforms have 10 movies AND 10 TV shows."""
    for key in PLATFORM_MAP.values():
        for cat in ("movies", "tv"):
            if len(output.get(key, {}).get(cat, [])) != 10:
                return False
    return True


# Main with retry logic
for attempt in range(1, MAX_RETRIES + 1):
    print(f"Attempt {attempt}/{MAX_RETRIES}...")

    text, html = fetch_page()
    if text is None:
        if attempt < MAX_RETRIES:
            delay = BASE_DELAY * (2 ** (attempt - 1))
            print(f"  Retrying in {delay}s...", file=sys.stderr)
            time.sleep(delay)
        continue

    output = parse_items(text, html)

    if is_valid(output):
        with open(OUTPUT_PATH, "w") as f:
            json.dump({
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "data": output,
                "source": "flixpatrol",
            }, f, indent=2)
        print(f"\nSaved to {OUTPUT_PATH}")
        sys.exit(0)

    if attempt < MAX_RETRIES:
        delay = BASE_DELAY * (2 ** (attempt - 1))
        print(f"  Invalid results, retrying in {delay}s...", file=sys.stderr)
        time.sleep(delay)

print(f"\nFAILED after {MAX_RETRIES} attempts", file=sys.stderr)
sys.exit(1)
