#!/usr/bin/env python3
"""Scrape FlixPatrol Top 10 for Netflix, Disney+, Amazon Prime — Movies + TV Shows.
With retry logic: up to 3 attempts with exponential backoff."""
import subprocess
import json
import re
import sys
import time
from datetime import datetime, timezone

PLATFORM_MAP = {
    "Netflix": "netflix",
    "Disney+": "disney",
    "Amazon Prime": "amazon",
}

OUTPUT_PATH = "/home/ava/workspace/seriez-2026-06-09/data/streaming-top10.json"
MAX_RETRIES = 3
BASE_DELAY = 10  # seconds

def fetch_page():
    """Fetch FlixPatrol top10 page via wg. Returns text or None."""
    cmd = [
        "wg", "https://flixpatrol.com/top10/",
        "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        print(f"wg failed: {result.stderr}", file=sys.stderr)
        return None
    return result.stdout

def parse_items(text):
    """Parse streaming top 10 items from FlixPatrol. Returns {platform: {movies:[], tv:[]}}."""
    header_pattern = re.compile(r'^TOP (Movies|TV Shows) on (.+?) on \w+ \d+, \d+', re.MULTILINE)
    headers = [(m.start(), m.group(1), m.group(2)) for m in header_pattern.finditer(text)]
    item_pattern = re.compile(r'^(\d+)\.\t\n(.+?)\n\t(\d+)', re.MULTILINE)

    # Initialize all platforms with empty movies/tv
    output = {}
    for key in PLATFORM_MAP.values():
        output[key] = {"movies": [], "tv": []}

    for i, (pos, media_type, platform) in enumerate(headers):
        key = PLATFORM_MAP.get(platform)
        if key is None:
            continue

        category = "movies" if media_type == "Movies" else "tv"
        end_pos = headers[i + 1][0] if i + 1 < len(headers) else len(text)
        section = text[pos:end_pos]

        items = []
        for m in item_pattern.finditer(section):
            rank = int(m.group(1))
            title = m.group(2).strip()
            score = int(m.group(3))
            if rank <= 10:
                items.append({"rank": rank, "title": title, "score": score})

        output[key][category] = items
        print(f"  {key}/{category}: {len(items)} items")

    # Warn if any category missing
    for key in PLATFORM_MAP.values():
        for cat in ("movies", "tv"):
            if len(output[key][cat]) == 0:
                print(f"  WARNING: {key}/{cat} is empty", file=sys.stderr)

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

    text = fetch_page()
    if text is None:
        if attempt < MAX_RETRIES:
            delay = BASE_DELAY * (2 ** (attempt - 1))
            print(f"  Retrying in {delay}s...", file=sys.stderr)
            time.sleep(delay)
        continue

    output = parse_items(text)

    if is_valid(output):
        # Success! Save and exit
        with open(OUTPUT_PATH, "w") as f:
            json.dump({
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "data": output
            }, f, indent=2)
        print(f"\nSaved to {OUTPUT_PATH}")
        sys.exit(0)

    if attempt < MAX_RETRIES:
        delay = BASE_DELAY * (2 ** (attempt - 1))
        print(f"  Invalid results, retrying in {delay}s...", file=sys.stderr)
        time.sleep(delay)

# All retries exhausted
print(f"\nFAILED after {MAX_RETRIES} attempts", file=sys.stderr)
sys.exit(1)
