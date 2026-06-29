#!/usr/bin/env python3
"""Detect real human visitors in last 10 minutes and alert via Telegram."""

import subprocess
import re
import os
from datetime import datetime, timedelta, timezone

ACCESS_LOG = "/var/log/nginx/access.log"
SEEN_FILE = "/tmp/recent_visitors.txt"
TOKEN = "8711679151:AAGBfkaukve_sTBa_T8DIaTCVOvDqAXFN8s"
CHAT_ID = "893313394"

# Bot patterns to exclude
BOT_PATTERNS = [
    "GPTBot", "ClaudeBot", "CCBot", "Bytespider", "PerplexityBot",
    "Amazonbot", "Google-Extended", "cohere", "anthropic-ai",
    "FacebookBot", "omgili", "ImagesiftBot", "OAI-SearchBot",
    "Claude-SearchBot", "Headless", "scraper", "curl", "wget",
    "python-requests", "Go-http-client", "bot", "crawler", "spider",
    "scan", "monitor", "check", "uptime",
]

# Load already seen IPs (last 6 hours to avoid spam)
seen = {}
if os.path.exists(SEEN_FILE):
    with open(SEEN_FILE) as f:
        for line in f:
            parts = line.strip().split(",", 1)
            if len(parts) == 2:
                seen[parts[0]] = parts[1]

def is_bot(ua: str) -> bool:
    for bp in BOT_PATTERNS:
        if bp.lower() in ua.lower():
            return True
    return False

def has_real_browser(ua: str) -> bool:
    # Real browsers
    if re.search(r"Chrome/\d{2,3}\.\d", ua): return True
    if re.search(r"Safari/\d{3,}", ua): return True
    if re.search(r"Firefox/\d{2,3}", ua): return True
    if re.search(r"Edg/\d{2,3}", ua): return True
    return False

def send_telegram(msg: str):
    try:
        subprocess.run([
            "curl", "-s", "-X", "POST",
            f"https://api.telegram.org/bot{TOKEN}/sendMessage",
            "-d", f"chat_id={CHAT_ID}",
            "-d", f"text={msg}",
            "-d", "parse_mode=Markdown",
            "--connect-timeout", "5", "--max-time", "5"
        ], timeout=10)
    except Exception:
        pass

# Time window: last 10 minutes
cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).strftime("%d/%b/%Y:%H:%M")
today = datetime.now(timezone.utc).strftime("%d/%b/%Y")

visitors = {}  # ip -> {pages, ua, referer}

try:
    with open(ACCESS_LOG, errors="ignore") as f:
        for line in f:
            if today not in line:
                continue
            # Check time
            time_match = re.search(r"\[(\d{2}/\w{3}/\d{4}:\d{2}:\d{2})", line)
            if not time_match or time_match.group(1) < cutoff:
                continue

            ip = re.match(r"^(\S+)", line)
            if not ip:
                continue
            ip = ip.group(1)

            # Skip if alerted within 6 hours
            if ip in seen:
                continue

            # Extract User-Agent
            ua_match = re.search(r'"([^"]*)" \d+ \d+ "', line)
            if not ua_match:
                continue
            ua = ua_match.group(1)

            if is_bot(ua) or not has_real_browser(ua):
                continue

            # Extract request and status
            req_match = re.search(r'"GET (\S+) HTTP', line)
            status_match = re.search(r'" \d+ \d+ ".*" (\d{3}) ', line)
            if not req_match or not status_match:
                continue

            status = status_match.group(1)
            if status != "200":
                continue

            page = req_match.group(1)
            # Skip image/static requests
            if page.startswith("/_next/") or page.startswith("/icons/") or page.endswith((".png", ".jpg", ".ico", ".woff2", ".js", ".css")):
                continue

            if ip not in visitors:
                visitors[ip] = {"pages": [], "ua": ua[:100], "page_count": 0}
            visitors[ip]["pages"].append(page)
            visitors[ip]["page_count"] += 1
except Exception as e:
    print(f"Error: {e}")
    exit(1)

# Alert new visitors (minimum 1 real page hit)
alerts = []
for ip, data in visitors.items():
    # Only alert if they visited at least 1 real page
    unique_pages = list(set(data["pages"]))[:5]
    pages_str = ", ".join(unique_pages)
    os_info = re.search(r"\(([^)]+)\)", data["ua"])
    device = os_info.group(1) if os_info else "Unknown"
    alerts.append(f"👤 *방문자 감지*\n"
                   f"IP: `{ip}`\n"
                   f"기기: {device}\n"
                   f"페이지({data['page_count']}): {pages_str}")

    # Mark as seen
    with open(SEEN_FILE, "a") as f:
        f.write(f"{ip},{datetime.now().isoformat()}\n")
    seen[ip] = datetime.now().isoformat()

# Clean old entries from seen file (keep last 24h)
cutoff_time = datetime.now() - timedelta(hours=24)
if os.path.exists(SEEN_FILE):
    lines = []
    with open(SEEN_FILE) as f:
        for line in f:
            parts = line.strip().split(",", 1)
            if len(parts) == 2:
                try:
                    ts = datetime.fromisoformat(parts[1])
                    if ts > cutoff_time:
                        lines.append(line.strip())
                except:
                    pass
    with open(SEEN_FILE, "w") as f:
        f.write("\n".join(lines) + "\n" if lines else "")

# Send alerts
for alert in alerts:
    send_telegram(alert)
    print(f"Alerted: {alert[:80]}...")

print(f"Visitors: {len(visitors)}, Alerts: {len(alerts)}")
