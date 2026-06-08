#!/bin/bash
cd /root/seriez
export TMDB_API_KEY=REDACTED
export NEXT_PUBLIC_SUPABASE_URL=https://zntyjtjodyzizoafxord.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=REDACTED
fuser -k 3000/tcp 2>/dev/null
sleep 1
npm run build
pm2 delete seriez 2>/dev/null
sleep 1
pm2 start server.js --name seriez
pm2 save
echo Done
