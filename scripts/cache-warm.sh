#!/bin/bash
# Cache warming: visit all title pages so first real user gets CDN HIT
# Run after deploy: bash scripts/cache-warm.sh

SITEMAP_URL="https://seriez.app/sitemap.xml"
COUNT=0

echo "[cache-warm] fetching sitemap..."
URLS=$(curl -s "$SITEMAP_URL" | grep -oP 'https://seriez\.app/title/[^<]+' | sort -u)

TOTAL=$(echo "$URLS" | wc -l)
echo "[cache-warm] found $TOTAL title URLs, warming..."

for url in $URLS; do
    STATUS=$(curl -sL -o /dev/null -w '%{http_code}' --max-time 30 "$url" 2>/dev/null)
    COUNT=$((COUNT + 1))
    if [ $((COUNT % 50)) -eq 0 ]; then
        echo "[cache-warm] $COUNT/$TOTAL..."
    fi
done

echo "[cache-warm] done: $COUNT URLs visited"
