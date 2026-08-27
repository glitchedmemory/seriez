// Seriez Poll 기능 DB 마이그레이션 — pg 모듈로 직접 실행
// 실행: cd /home/ava/workspace/seriez-2026-06-09 && node migration_polls.js && rm migration_polls.js
const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-us-west-2.pooler.supabase.com', port: 5432,
  database: 'postgres', user: 'postgres.zntyjtjodyzizoafxord',
  password: 'Djfbm99#HoH4',
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000,
});

const statements = [
  // polls
  `create table if not exists public.polls (
    id uuid primary key default gen_random_uuid(),
    question jsonb not null default '{}'::jsonb,
    options jsonb not null default '{}'::jsonb,
    status text not null default 'active',
    starts_at timestamptz,
    ends_at timestamptz,
    created_by uuid,
    created_at timestamptz not null default now(),
    closed_at timestamptz
  )`,
  // poll_votes
  `create table if not exists public.poll_votes (
    id uuid primary key default gen_random_uuid(),
    poll_id uuid not null references public.polls(id) on delete cascade,
    user_id uuid not null,
    option_index int not null,
    created_at timestamptz not null default now(),
    unique (poll_id, user_id)
  )`,
  `create index if not exists idx_poll_votes_poll on public.poll_votes (poll_id)`,
  `create index if not exists idx_polls_status on public.polls (status) where status = 'active'`,

  // RLS enable
  `alter table public.polls enable row level security`,
  `alter table public.poll_votes enable row level security`,

  // polls: public read
  `drop policy if exists "polls_public_read" on public.polls`,
  `create policy "polls_public_read" on public.polls for select using (true)`,

  // poll_votes: anon/authenticated 읽기 차단 (admin API만 열람)
  `drop policy if exists "poll_votes_no_read" on public.poll_votes`,
  `create policy "poll_votes_no_read" on public.poll_votes for select using (false)`,

  // ★ service_role bypass (프로젝트 관례: service_role도 명시 정책 필요)
  `drop policy if exists "polls_service_role_all" on public.polls`,
  `create policy "polls_service_role_all" on public.polls for all to service_role using (true) with check (true)`,
  `drop policy if exists "poll_votes_service_role_all" on public.poll_votes`,
  `create policy "poll_votes_service_role_all" on public.poll_votes for all to service_role using (true) with check (true)`,
];

(async () => {
  await client.connect();
  for (const sql of statements) {
    await client.query(sql);
    console.log('✓', sql.slice(0, 70).replace(/\s+/g, ' '));
  }
  await client.end();
  console.log('\n✅ Poll DB 마이그레이션 완료');
})().catch(async (e) => {
  console.error('❌', e.message);
  await client.end();
  process.exit(1);
});
