#!/usr/bin/env python3
"""Hourly visitor report — count real human visitors in last 60 minutes."""

import subprocess
import re
import os
import json
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

# Geo cache
GEO_CACHE = {}

def get_geo(ip: str) -> dict:
    """Return dict with flag, location, isp, org, hosting flag. Cached in memory."""
    if ip in GEO_CACHE:
        return GEO_CACHE[ip]
    try:
        r = subprocess.run([
            "curl", "-s",
            f"http://ip-api.com/json/{ip}?fields=country,countryCode,city,isp,org,hosting,proxy",
            "--connect-timeout", "3", "--max-time", "3"
        ], capture_output=True, text=True, timeout=5)
        data = json.loads(r.stdout)
        cc = data.get("countryCode", "??")
        country = data.get("country", "Unknown")
        city = data.get("city", "")
        isp = data.get("isp", "")
        org = data.get("org", "")
        hosting = data.get("hosting", False)
        proxy = data.get("proxy", False)

        if len(cc) == 2:
            flag = chr(ord(cc[0]) + 127397) + chr(ord(cc[1]) + 127397)
        else:
            flag = "🌐"

        loc = f"{city}, {country}" if city else country
        result = {
            "loc": loc, "flag": flag, "country": country,
            "isp": org or isp, "hosting": hosting or proxy
        }
        GEO_CACHE[ip] = result
        return result
    except Exception:
        fallback = {"loc": "Unknown", "flag": "🌐", "country": "Unknown", "isp": "", "hosting": False}
        GEO_CACHE[ip] = fallback
        return fallback

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

            # Extract referrer + User-Agent
            ref_ua_match = re.search(r'"([^"]*)"\s+"([^"]*)"\s+cf="', line)
            if not ref_ua_match:
                continue
            referrer = ref_ua_match.group(1)
            ua = ref_ua_match.group(2)

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
                visitors[ip] = {"pages": set(), "os": os_info.group(1) if os_info else "Unknown", "ref": referrer}
            visitors[ip]["pages"].add(page)
            # Keep most informative referrer: external > internal > direct
            cur_ref = visitors[ip]["ref"]
            if cur_ref == "-" or cur_ref.startswith("https://seriez.app"):
                if referrer != "-" and not referrer.startswith("https://seriez.app"):
                    visitors[ip]["ref"] = referrer
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

start = (datetime.now(timezone.utc) - timedelta(minutes=60)).strftime("%H:%M")
end = datetime.now(timezone.utc).strftime("%H:%M")
pdt_start = (datetime.now(timezone.utc) - timedelta(minutes=60, hours=7)).strftime("%H:%M")
pdt_end = (datetime.now(timezone.utc) - timedelta(hours=7)).strftime("%H:%M")

def page_label(path: str) -> str:
    if path == "/":
        return "메인 페이지"
    if path.startswith("/api/streaming-top10"):
        return "Streaming Top 10"
    if path.startswith("/api/anime-trending"):
        return "Anime Trending"
    if path.startswith("/api/movie-trending"):
        return "Movie Trending"
    if path.startswith("/api/tv-trending"):
        return "TV Trending"
    if path.startswith("/api/genre"):
        return "장르 탐색"
    if path.startswith("/movie/"):
        return "영화 상세"
    if path.startswith("/tv/"):
        return "TV 상세"
    if path.startswith("/search"):
        return "검색"
    return path.split("?")[0]

def device_desc(os_str: str) -> str:
    """Return natural device description in Korean."""
    os_l = os_str.lower()
    if "iphone" in os_l:
        m = re.search(r"iphone os (\d+)_(\d+)", os_l)
        if m:
            ver = f"{m.group(1)}.{m.group(2)}"
            return f"iPhone iOS {ver}"
        return "iPhone"
    if "android" in os_l:
        m = re.search(r"android (\d+)", os_l)
        return f"Android {m.group(1)}" if m else "Android"
    if "macintosh" in os_l:
        return "Mac"
    if "windows nt" in os_l:
        m = re.search(r"windows nt (\d+\.\d+)", os_l)
        if m:
            v = float(m.group(1))
            if v >= 10.0:
                return "Windows 10/11"
            return f"Windows {int(v)}"
        return "Windows"
    if "linux" in os_l:
        return "Linux"
    return os_str

def is_api_only(pages: list) -> bool:
    """True if all pages are API endpoints."""
    non_api = [p for p in pages if p in ("메인 페이지", "영화 상세", "TV 상세", "검색")]
    return len(non_api) == 0

def is_suspicious_ua(os_str: str) -> str:
    """Return suspicion note if UA looks fake/old, empty string otherwise."""
    os_l = os_str.lower()
    if "iphone os" in os_l:
        m = re.search(r"iphone os (\d+)_", os_l)
        if m and int(m.group(1)) <= 13:
            return "구버전 iOS라 UA 스푸핑 가능성이 있습니다"
    if "mac os x" in os_l:
        m = re.search(r"mac os x (\d+)_", os_l)
        if m and int(m.group(1)) <= 9:
            return "매우 오래된 Mac OS 버전이라 의심스럽습니다"
    if "windows nt 5" in os_l or "windows nt 6.0" in os_l:
        return "오래된 Windows 버전이라 의심스럽습니다"
    if "firefox/10" in os_l or "firefox/11" in os_l:
        return "구형 Firefox 버전"
    return ""

def ref_label(ref: str) -> str:
    """Translate referrer URL to readable source."""
    if ref == "-":
        return "직접 방문"
    if "google.com" in ref:
        return "Google 검색"
    if "bing.com" in ref:
        return "Bing 검색"
    if "duckduckgo.com" in ref:
        return "DuckDuckGo 검색"
    if "yahoo.com" in ref:
        return "Yahoo 검색"
    if "seriez.app" in ref:
        return "Seriez 내 이동"
    # Return domain only
    m = re.search(r"https?://([^/]+)", ref)
    return m.group(1) if m else ref

def assess_visitor(ip: str, geo: dict, data: dict, pages: list, page_count: int) -> str:
    """Build a narrative assessment sentence for one visitor."""
    parts = []
    dev = device_desc(data["os"])
    sus = is_suspicious_ua(data["os"])
    pg_list = ", ".join(pages)
    ref_src = ref_label(data.get("ref", "-"))

    if geo["hosting"]:
        # Datacenter/VPN
        parts.append(f"{geo['flag']} {geo['loc']}에서 {ref_src}으로 — {dev}.")
        parts.append(f"{geo['isp']}(데이터센터/VPN)입니다.")
        if is_api_only(pages):
            parts.append(f"{pg_list} API만 찔러보는 패턴으로, 거의 확실히 봇/스크래퍼입니다.")
        elif page_count == 1 and pages[0] == "메인 페이지":
            parts.append(f"{pg_list} 한 페이지만 보고 갔습니다. 봇 가능성이 높습니다.")
        else:
            parts.append(f"{pg_list} 등을 봤습니다. 데이터센터 IP라 봇으로 추정됩니다.")
    else:
        # Residential ISP
        parts.append(f"{geo['flag']} {geo['loc']}에서 {ref_src}으로 — {dev}.")
        parts.append(f"{geo['isp']}(ISP)입니다.")
        if sus:
            parts.append(f"{sus}.")
            if page_count <= 1:
                parts.append(f"{pg_list} 한 페이지만 봤습니다. 실제 사람일 가능성은 낮아 보입니다.")
            else:
                parts.append(f"{pg_list} 등을 봤습니다. 사람일 수도 있지만 UA가 의심스럽습니다.")
        else:
            if page_count <= 1:
                parts.append(f"{pg_list} 한 페이지만 보고 이탈했습니다. 실제 사람일 가능성이 있긴 한데, 단발성 방문이라 확실하진 않습니다.")
            else:
                parts.append(f"{pg_list} 등을 둘러봤습니다. 실제 유저일 가능성이 높습니다.")

    return " ".join(parts)

if not visitors:
    print("Report: 0 visitors")
    exit(0)

# Group IPs by ISP for cleaner report
groups = []  # [(ips, isp, hosting, shared_geo)]
seen = set()
for ip, data in sorted(visitors.items()):
    if ip in seen:
        continue
    geo = get_geo(ip)
    # Find same-ISP IPs
    siblings = [ip]
    for ip2, data2 in sorted(visitors.items()):
        if ip2 != ip and ip2 not in seen:
            geo2 = get_geo(ip2)
            if geo["isp"] == geo2["isp"] and geo["hosting"] == geo2["hosting"]:
                siblings.append(ip2)
                seen.add(ip2)
    seen.add(ip)
    groups.append((siblings, geo))

lines = ["분석 결과입니다.", ""]
lines.append(f"지난 한 시간({pdt_start}~{pdt_end} PDT): {len(visitors)}명, {page_requests}페이지뷰 기록됐습니다.")
lines.append("")
lines.append("하지만 IP 들여다보면:")
lines.append("")

for ips, geo in groups:
    for ip in ips:
        data = visitors[ip]
        pages = [page_label(p) for p in list(data["pages"])[:5]]
        pg_count = sum(1 for p in data["pages"] if not p.startswith("/api/"))

        if len(ips) > 1 and ip == ips[0]:
            # Group header
            ip_list = " / ".join(ips)
            # Merge referrers: pick most informative
            merged_ref = "-"
            for sip in ips:
                r = visitors[sip].get("ref", "-")
                if r != "-" and not r.startswith("https://seriez.app"):
                    merged_ref = r
                    break
            ref_src = ref_label(merged_ref)
            lines.append(f"- {ip_list} — 둘 다 {geo['isp']}({'데이터센터/VPN' if geo['hosting'] else 'ISP'})입니다. {ref_src}으로 유입. ")
            # Merge pages
            all_pages = set()
            for sip in ips:
                all_pages.update(page_label(p) for p in list(visitors[sip]["pages"])[:5])
            merged = list(all_pages)[:5]
            if is_api_only(merged):
                lines[-1] += f"{', '.join(merged)} API만 찔러보는 패턴으로, 거의 확실히 봇/스크래퍼입니다."
            else:
                lines[-1] += f"{', '.join(merged)} 등을 봤습니다. {'데이터센터 IP라 봇으로 추정됩니다.' if geo['hosting'] else ''}"
        elif len(ips) == 1:
            lines.append(f"- {ip} — {assess_visitor(ip, geo, data, pages, pg_count)}")

    lines.append("")

# Build conclusion
hosting_count = sum(1 for ip in visitors if get_geo(ip)["hosting"])
isp_count = len(visitors) - hosting_count

conclusion_parts = []
if isp_count == 0:
    conclusion_parts.append(f"실제 유저라고 볼 만한 건 없고, {hosting_count}건 전부 봇/스크래퍼로 보입니다.")
elif isp_count == 1:
    conclusion_parts.append(f"실제 유저라고 볼 만한 건 ISP IP {isp_count}건 정도고, 나머지 {hosting_count}건은 봇/스크래퍼로 보입니다.")
else:
    conclusion_parts.append(f"실제 유저라고 볼 만한 건 ISP IP {isp_count}건 정도고, 나머지 {hosting_count}건은 봇/스크래퍼로 보입니다.")

if isp_count == 0:
    conclusion_parts.append("실제 사람 유입은 거의 없는 상태예요.")
elif isp_count <= 1:
    conclusion_parts.append("아직 실제 사람 유입은 미미한 수준입니다.")
else:
    conclusion_parts.append("서서히 실제 유저 유입이 시작되고 있는 것 같습니다.")

lines.append(f"결론: {' '.join(conclusion_parts)}")

send_telegram("\n".join(lines))
print(f"Report: {len(visitors)} visitors")
