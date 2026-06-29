#!/usr/bin/env python3
"""Detect fake/scanner User-Agents in nginx logs and block via iptables."""

import subprocess
import re
import os

ACCESS_LOG = "/var/log/nginx/access.log"
BLOCKED_FILE = "/etc/iptables/blocked_ips.txt"
TOKEN = "8711679151:AAGBfkaukve_sTBa_T8DIaTCVOvDqAXFN8s"
CHAT_ID = "893313394"

# Load already blocked IPs
blocked = set()
if os.path.exists(BLOCKED_FILE):
    with open(BLOCKED_FILE) as f:
        blocked = set(line.strip() for line in f if line.strip())

# Fake OS version patterns (OS versions that don't exist)
FAKE_PATTERNS = [
    r"Mac OS X (\d+)_\d+_\d+",       # Mac OS X major version check
    r"Windows NT (\d+)_\d+_\d+",      # Windows NT major version check
]

def is_impossible_os(ua: str) -> str | None:
    """Returns reason if OS version is impossible, None otherwise."""
    for pattern in FAKE_PATTERNS:
        m = re.search(pattern, ua)
        if m:
            major = int(m.group(1))
            if "Mac OS X" in pattern:
                # Mac OS X 1-9 don't exist (first was 10.0)
                if major <= 9:
                    return f"Mac OS X {major}.x (non-existent)"
            if "Windows NT" in pattern:
                # NT 1.x never released, NT 2.x is NT4 era, NT 7+ don't exist beyond Win10 (10.0)
                if major >= 7:
                    return f"Windows NT {major}.x (non-existent)"
    return None

def send_telegram(msg: str):
    try:
        subprocess.run([
            "curl", "-s", "-X", "POST",
            f"https://api.telegram.org/bot{TOKEN}/sendMessage",
            "-d", f"chat_id={CHAT_ID}",
            "-d", f"text={msg}",
            "--connect-timeout", "5",
            "--max-time", "5"
        ], timeout=10)
    except Exception:
        pass

def block_ip(ip: str, reason: str):
    if ip in blocked:
        return
    subprocess.run(["iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"], check=True)
    subprocess.run(["iptables-save"], stdout=open("/etc/iptables/rules.v4", "w"), check=True)
    with open(BLOCKED_FILE, "a") as f:
        f.write(f"{ip}\n")
    blocked.add(ip)
    send_telegram(f"🚫 IP 차단됨: {ip}\n이유: {reason}")

# Scan for yesterday + today (log rotation)
from datetime import datetime, timedelta
yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%d/%b/%Y")
today = datetime.utcnow().strftime("%d/%b/%Y")

suspicious = {}  # ip -> {count, reason, sample_ua}

try:
    with open(ACCESS_LOG, errors="ignore") as f:
        for line in f:
            # Check if line is from today or yesterday
            if yesterday not in line and today not in line:
                continue
            # Extract IP
            ip_match = re.match(r"^(\S+)", line)
            if not ip_match:
                continue
            ip = ip_match.group(1)
            if ip in blocked:
                continue
            # Extract User-Agent
            ua_match = re.search(r'"([^"]*)" \d+ \d+ "', line)
            if not ua_match:
                continue
            ua = ua_match.group(1)
            reason = is_impossible_os(ua)
            if reason:
                if ip not in suspicious:
                    suspicious[ip] = {"count": 0, "reason": reason, "sample": ua[:120]}
                suspicious[ip]["count"] += 1
except Exception as e:
    print(f"Error: {e}")
    exit(1)

# Block IPs with >= 3 fake requests
for ip, data in suspicious.items():
    if data["count"] >= 3:
        block_ip(ip, f"{data['reason']} ({data['count']} requests)")
        print(f"Blocked {ip}: {data['reason']}")

print(f"Scanned. Suspicious IPs: {len(suspicious)}, Blocked: {sum(1 for d in suspicious.values() if d['count'] >= 3)}")
