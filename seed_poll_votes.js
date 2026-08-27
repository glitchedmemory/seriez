// 첫 투표 324표 시드 (AP-NORC 조사: 극장 33% / 스트리밍 67%)
// 단일 SQL(generate_series) + md5 결정적 UUID — 파라미터 타입 문제 없음
const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-us-west-2.pooler.supabase.com', port: 5432,
  database: 'postgres', user: 'postgres.zntyjtjodyzizoafxord',
  password: 'Djfbm99#HoH4',
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000,
});

(async () => {
  await client.connect();

  const TOTAL = 324;
  const THEATER = Math.round(TOTAL * 0.33);  // 107
  const STREAMING = TOTAL - THEATER;          // 217

  const { rows } = await client.query(
    `select id from public.polls where status = 'active' order by created_at desc limit 1`
  );
  if (!rows.length) { console.log('active poll 없음'); await client.end(); return; }
  const pollId = rows[0].id;

  // 1) 기존 시드 표 제거 (재실행 안전): md5 결정적 uuid와 일치하는 것만
  await client.query(`
    delete from public.poll_votes
    where poll_id = $1 and
      user_id::text in (
        select md5('poll-seed-synthetic-' || g)::uuid::text
        from generate_series(0, 323) g
      )
  `, [pollId]);

  // 2) 단일 SQL로 324표 삽입 (md5로 결정적 uuid 생성)
  //    0..106 → option 0 (극장), 107..323 → option 1 (스트리밍)
  await client.query(`
    insert into public.poll_votes (poll_id, user_id, option_index)
    select $1::uuid,
           (md5('poll-seed-synthetic-' || g))::uuid,
           case when g < $2::int then 0 else 1 end
    from generate_series(0, 323) g
  `, [pollId, THEATER]);

  console.log(`✅ ${TOTAL}표 시드 완료`);
  console.log(`극장(index 0): ${THEATER}표 (${(THEATER/TOTAL*100).toFixed(1)}%)`);
  console.log(`스트리밍(index 1): ${STREAMING}표 (${(STREAMING/TOTAL*100).toFixed(1)}%)`);

  await client.end();
})().catch(async (e) => { console.error('❌', e.message); await client.end(); process.exit(1); });
