#!/bin/bash
cd /root/seriez
cat > .env << 'EOF'
TMDB_API_KEY=26702e3672b4637b59fe207c58e56bf3
NEXT_PUBLIC_SUPABASE_URL=https://zntyjtjodyzizoafxord.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REDACTED
EOF
fuser -k 3000/tcp 2>/dev/null
pm2 restart seriez --update-env
echo "Done"
