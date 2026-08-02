#!/bin/bash
# Cache warming: visit all title pages through Cloudflare from local machine
# Run after deploy or periodically to keep CDN cache warm
# Must run from WSL (not VPS — Cloudflare blocks VPS IP)

SITEMAP_URL="https://seriez.app/sitemap.xml"

echo "[cache-warm] fetching sitemap..."
# Extract ALL language alternates (not just <loc> English URLs)
curl -s "$SITEMAP_URL" \
  | grep -oP 'href="https://seriez\.app[^"]+/(movie|tv|anime)[^"]*"' \
  | sed 's/href="//' \
  | sort -u > /tmp/seriez-cache-urls.txt

TOTAL=$(wc -l < /tmp/seriez-cache-urls.txt)
echo "[cache-warm] $TOTAL URLs, warming with 10 parallel..."

xargs -P 10 -I {} sh -c 'curl -sL -o /dev/null --max-time 30 "{}"' < /tmp/seriez-cache-urls.txt

echo "[cache-warm] done: $TOTAL URLs"
