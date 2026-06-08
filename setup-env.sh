#!/bin/bash
cd /root/seriez
cat > .env << 'EOF'
TMDB_API_KEY=26702e3672b4637b59fe207c58e56bf3
NEXT_PUBLIC_SUPABASE_URL=https://zntyjtjodyzizoafxord.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpudHlqdGpvZHl6aXpvYWZ4b3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MzMwOTcsImV4cCI6MjA5NjIwOTA5N30.3KFa93KLzv8np-oJlg_7l-Y27emr7qynnP-59G9mjGU
EOF
fuser -k 3000/tcp 2>/dev/null
pm2 restart seriez --update-env
echo "Done"
