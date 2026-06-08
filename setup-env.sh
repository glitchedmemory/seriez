#!/bin/bash
cd /root/seriez
export TMDB_API_KEY=1ff9c4d7f4c5c023c972a8a49b1f1c47
export NEXT_PUBLIC_SUPABASE_URL=https://zntyjtjodyzizoafxord.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpudHlqdGpvZHl6aXpvYWZ4b3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MzMwOTcsImV4cCI6MjA5NjIwOTA5N30.3KFa93KLzv8np-oJlg_7l-Y27emr7qynnP-59G9mjGU
fuser -k 3000/tcp 2>/dev/null
sleep 1
npm run build
pm2 delete seriez 2>/dev/null
sleep 1
pm2 start server.js --name seriez
pm2 save
echo Done
