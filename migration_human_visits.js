// human_visits 테이블 마이그레이션 — 클라이언트 JS 실행 증명 기반 "진짜 사람" 방문 기록
const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-us-west-2.pooler.supabase.com', port: 5432,
  database: 'postgres', user: 'postgres.zntyjtjodyzizoafxord',
  password: 'Djfbm99#HoH4',
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000,
});

const statements = [
  `create table if not exists public.human_visits (
    id uuid primary key default gen_random_uuid(),
    ip text,
    user_agent text,
    referrer text,
    path text,
    locale text,
    mouse_event_count int not null default 0,
    first_interaction_at timestamptz,
    sent_at timestamptz not null default now(),
    page_loaded_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists idx_human_visits_created on public.human_visits (created_at)`,
  `create index if not exists idx_human_visits_ip on public.human_visits (ip)`,

  // RLS: 쓰기는 service_role만 (클라이언트는 API 서버를 경유, anon 직접 쓰기 차단)
  `alter table public.human_visits enable row level security`,
  `drop policy if exists "human_visits_service_role_all" on public.human_visits`,
  `create policy "human_visits_service_role_all" on public.human_visits for all to service_role using (true) with check (true)`,
];

(async () => {
  await client.connect();
  for (const sql of statements) {
    await client.query(sql);
    console.log('✓', sql.slice(0, 65).replace(/\s+/g, ' '));
  }
  await client.end();
  console.log('\n✅ human_visits 테이블 마이그레이션 완료');
})().catch(async (e) => {
  console.error('❌', e.message);
  await client.end();
  process.exit(1);
});
