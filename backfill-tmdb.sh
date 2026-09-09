#!/bin/bash
# TMDB 데이터 전수 백필 — 수정판.
# 1) TV URL은 /season/1 붙임, 2) -L 리다이렉트 팔로우,
# 3) 병렬 2개로 낮춰 429 방지, 4) 429 시 재시도.
URLS=/tmp/backfill_urls.txt
LOG=/tmp/backfill_progress2.log

: > "$LOG"

crawl() {
  url="$1"
  path=$(echo "$url" | sed 's|https://seriez.app||')
  # TV URL은 /season/1 붙이기 (이미 붙어 있으면 통과)
  if echo "$path" | grep -q '^/tv/'; then
    if ! echo "$path" | grep -q '/season/'; then
      path="${path%/}/season/1"
    fi
  fi
  full="https://seriez.app${path}"
  for attempt in 1 2 3; do
    code=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 60 "$full?_backfill=$(date +%s)" 2>/dev/null)
    if [ "$code" = "200" ]; then
      echo "$full -> 200"
      return
    fi
    if [ "$code" != "429" ]; then
      echo "$full -> $code"
      return
    fi
    # 429: rate limit — 3초 대기 후 재시도
    sleep 3
  done
  echo "$full -> 429 (3회 재시도 실패)"
}

export -f crawl
export LOG

cat "$URLS" | xargs -P 2 -I {} bash -c 'crawl "{}"' >> "$LOG"

echo "=== BACKFILL DONE ==="
echo "성공(200): $(grep -c '-> 200' "$LOG")"
echo "실패: $(grep -vc '-> 200' "$LOG")"
echo "총: $(wc -l < "$LOG")"
