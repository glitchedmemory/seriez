#!/usr/bin/env python3
"""Hourly visitor report — count real human visitors in last 60 minutes."""

import subprocess
import re
import os
from datetime import datetime, timedelta, timezone

ACCESS_LOG = "/var/log/nginx/access.log"
TOKEN = "8711679151:AAGBfkaukve_sTBa_T8DIaTCVOvDqAXFN8s"
CHAT_ID = "893313394"

BOT_PATTERNS = [
    "GPTBot", "ClaudeBot", "CCBot", "Bytespider", "PerplexityBot",
    "Amazonbot", "Google-Extended", "cohere", "anthropic-ai",
    "FacebookBot", "omgili", "ImagesiftBot", "OAI-SearchBot",
    "Claude-SearchBot", "Headless", "scraper", "curl", "wget",
    "python-requests", "Go-http-client", "bot", "crawler", "spider",
    "scan", "monitor", "check", "uptime",
]

def is_bot(ua: str) -> bool:
    for bp in BOT_PATTERNS:
        if bp.lower() in ua.lower():
            return True
    # Fake OS check from blocker
    if re.search(r"Mac OS X ([0-9])_\d+_\d+", ua):
        major = int(re.search(r"Mac OS X ([0-9])_\d+_\d+", ua).group(1))
        if major <= 9: return True
    if re.search(r"Windows NT ([0-9]+)_\d+_\d+", ua):
        major = int(re.search(r"Windows NT ([0-9]+)_\d+_\d+", ua).group(1))
        if major >= 7: return True
    return False

def has_real_browser(ua: str) -> bool:
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
            "--connect-timeout", "5", "--max-time", "5"
        ], timeout=10)
    except Exception:
        pass

# Last 60 minutes
cutoff = (datetime.now(timezone.utc) - timedelta(minutes=60)).strftime("%d/%b/%Y:%H:%M")
today = datetime.now(timezone.utc).strftime("%d/%b/%Y")

visitors = {}  # ip -> {pages, ua, os}
admin_ips = set()
page_requests = 0  # total real page hits

try:
    with open(ACCESS_LOG, errors="ignore") as f:
        for line in f:
            if today not in line:
                continue
            time_match = re.search(r"\[(\d{2}/\w{3}/\d{4}:\d{2}:\d{2})", line)
            if not time_match or time_match.group(1) < cutoff:
                continue

            ip_match = re.match(r"^(\S+)", line)
            if not ip_match:
                continue

            # Extract User-Agent
            ua_match = re.search(r'"([^"]*)" \d+ \d+ "', line)
            if not ua_match:
                continue
            ua = ua_match.group(1)

            if is_bot(ua) or not has_real_browser(ua):
                continue

            # Must be a 200 OK
            if ' 200 ' not in line:
                continue

            # Extract page
            req_match = re.search(r'"GET (\S+) HTTP', line)
            if not req_match:
                continue
            page = req_match.group(1)

            # Skip static assets
            if page.startswith("/_next/") or page.startswith("/icons/") or \
               page.endswith((".png", ".jpg", ".ico", ".woff2", ".js", ".css", ".json")):
                continue

            ip = ip_match.group(1)

            # Skip admin IPs (X님)
            if page.startswith("/admin"):
                admin_ips.add(ip)
                continue
            if ip not in visitors:
                os_info = re.search(r"\(([^)]+)\)", ua)
                visitors[ip] = {"pages": set(), "os": os_info.group(1) if os_info else "Unknown"}
            visitors[ip]["pages"].add(page)
            page_requests += 1
except Exception as e:
    send_telegram(f"⚠️ 방문자 보고 오류: {e}")
    exit(1)

# Remove admin IPs from visitors
for ip in admin_ips:
    visitors.pop(ip, None)

# Build report
now = datetime.now(timezone.utc)
now_str = now.strftime("%H:%M UTC")
pdt = now - timedelta(hours=7)
pdt_str = pdt.strftime("%H:%M")

if visitors:
    lines = [f"📊 *{now_str} (PDT {pdt_str})*"]
    lines.append(f"방문자: {len(visitors)}명 | 페이지: {page_requests}회")
    for ip, data in sorted(visitors.items()):
        pages = list(data["pages"])[:3]
        lines.append(f"  `{ip}` — {data['os']}")
        for p in pages:
            lines.append(f"    {p}")
    send_telegram("\n".join(lines))

print(f"Report: {len(visitors)} visitors")
