// One-time setup: create trailer_cache table
import { createClient } from '@supabase/supabase-js';

const URL = 'https://zntyjtjodyzizoafxord.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpudHlqdGpvZHl6aXpvYWZ4b3JkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYzMzA5NywiZXhwIjoyMDk2MjA5MDk3fQ.AwCNozt98O1pqkGu29jeOszpVH4VXl19E74TYeKZ-Eg';

const supabase = createClient(URL, KEY);

async function main() {
  // Create table via raw SQL using REST API
  const res = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      sql: `CREATE TABLE IF NOT EXISTS trailer_cache (anime_id INTEGER PRIMARY KEY, youtube_key TEXT NOT NULL, validated_at TIMESTAMPTZ DEFAULT NOW())`
    }),
  });
  const data = await res.json();
  console.log('Status:', res.status, data);
}

main();
