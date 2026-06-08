#!/bin/bash
set -e
cd /root/seriez

export TMDB_API_KEY=REDACTED
export NEXT_PUBLIC_SUPABASE_URL=https://zntyjtjodyzizoafxord.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=REDACTED

# Kill any processes on port 3000
fuser -k 3000/tcp 2>/dev/null || true
sleep 1
ss -tlnp | grep ':3000' | grep -oP 'pid=\d+' | cut -d= -f2 | xargs -r kill -9 2>/dev/null || true
sleep 1

# Stop existing PM2 process
pm2 delete seriez 2>/dev/null || true

# Clean Turbopack cache (prevents stale chunk name issues)
rm -rf .next

# Build with verification
echo "Building..."
npm run build

# Verify build output exists
if [ ! -d ".next" ]; then
  echo "ERROR: Build failed — .next directory not found"
  exit 1
fi

if [ ! -f ".next/BUILD_ID" ]; then
  echo "ERROR: Build incomplete — BUILD_ID missing"
  exit 1
fi

echo "Build verified: $(cat .next/BUILD_ID)"

# Ensure logs directory
mkdir -p logs

# Start with ecosystem config (next start, no custom server)
pm2 start ecosystem.config.js
pm2 save

echo "Done"
