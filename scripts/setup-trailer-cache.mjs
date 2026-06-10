// One-time setup: create trailer_cache table
import { createClient } from '@supabase/supabase-js';

const URL = 'https://zntyjtjodyzizoafxord.supabase.co';
const KEY = 'REDACTED';

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
