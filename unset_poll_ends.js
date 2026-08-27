// active poll의 ends_at을 NULL로 변경 (무기한 = 수동 종료 전까지 오픈)
const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-us-west-2.pooler.supabase.com', port: 5432,
  database: 'postgres', user: 'postgres.zntyjtjodyzizoafxord',
  password: 'Djfbm99#HoH4',
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000,
});

(async () => {
  await client.connect();
  const { rows } = await client.query(
    `update public.polls set ends_at = null where status = 'active' returning id, ends_at`
  );
  if (!rows.length) { console.log('active poll 없음'); await client.end(); return; }
  await client.end();
})().catch(async (e) => { console.error('❌', e.message); await client.end(); process.exit(1); });
