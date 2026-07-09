#!/bin/bash
# Cache warming: visit all title pages so first real user gets CDN HIT
# Run after deploy on VPS: bash scripts/cache-warm.sh

COUNT=0
BASE="http://127.0.0.1:3000"

echo "[cache-warm] fetching sitemap..."
URLS=$(curl -s "$BASE/sitemap.xml" -H "Host: seriez.app" | sed -n 's/.*<loc>\(https:\/\/seriez\.app\/title\/[^<]*\)<\/loc>.*/\1/p' | sort -u)

TOTAL=$(echo "$URLS" | wc -l)
echo "[cache-warm] found $TOTAL title URLs, warming..."

for url in $URLS; do
    # Convert public URL back to localhost URL for warming
    local_url=$(echo "$url" | sed 's|https://seriez.app|http://127.0.0.1:3000|')
    STATUS=$(curl -sL -o /dev/null -w '%{http_code}' --max-time 30 -H "Host: seriez.app" "$local_url" 2>/dev/null)
    COUNT=$((COUNT + 1))
    if [ $((COUNT % 100)) -eq 0 ]; then
        echo "[cache-warm] $COUNT/$TOTAL..."
    fi
done

echo "[cache-warm] done: $COUNT/$TOTAL URLs visited"
