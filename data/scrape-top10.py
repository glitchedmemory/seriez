#!/usr/bin/env python3
"""Scrape FlixPatrol Top 10 for Netflix, Disney+, Amazon Prime and save to JSON."""
import subprocess
import json
import re
import sys
from datetime import datetime

# Each call to wg takes ~5-10s. We do one call and parse all platforms.
cmd = [
    "wg", "https://flixpatrol.com/top10/",
    "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
]

result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
if result.returncode != 0:
    print(f"wg failed: {result.stderr}", file=sys.stderr)
    sys.exit(1)

text = result.stdout

platforms = {
    "netflix": ("TOP Movies on Netflix", "TOP TV Shows on Netflix"),
    "disney": ("TOP Movies on Disney+", "TOP TV Shows on Disney+"),
    "amazon": ("TOP Movies on Amazon Prime", "TOP TV Shows on Amazon Prime"),
}

output = {}
for key, (start_marker, end_marker) in platforms.items():
    # Find the section
    start_idx = text.find(start_marker)
    end_idx = text.find(end_marker)
    if start_idx == -1 or end_idx == -1:
        print(f"Could not find section for {key}", file=sys.stderr)
        output[key] = []
        continue
    
    section = text[start_idx:end_idx]
    items = []
    # Match: number.\t\nTITLE\n\tSCORE\t
    for m in re.finditer(r'^(\d+)\.\t\n(.+?)\n\t(\d+)', section, re.MULTILINE):
        rank = int(m.group(1))
        title = m.group(2).strip()
        score = int(m.group(3))
        if rank <= 10:
            items.append({"rank": rank, "title": title, "score": score})
    
    output[key] = items
    print(f"{key}: {len(items)} items")

# Save to JSON
output_path = "/home/ava/workspace/seriez-2026-06-09/data/streaming-top10.json"
with open(output_path, "w") as f:
    json.dump({"updated_at": datetime.utcnow().isoformat() + "Z", "data": output}, f, indent=2)

print(f"\nSaved to {output_path}")
