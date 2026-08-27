// 첫 투표 시드: "영화는 극장에서 봐야 제맛이다 vs 스트리밍이다" — 8개 언어 번역 + DB 삽입
const { Client } = require('pg');

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'sk-c17db6a98888411f8733ec91c41d8fb7';
const LOCALES = ["en", "ko", "ja", "zh", "fr", "de", "es", "pt"];

const QUESTION_KO = "영화는 극장에서 봐야 제맛이다";
const OPTIONS_KO = ["극장에서 봐야 진짜다", "스트리밍으로 충분하다"];

async function translate(question, options, source, targets) {
  const prompt = [
    "You are a professional translator. Translate the following poll question and its two options into each target language.",
    "Return ONLY valid JSON (no markdown, no code fences) with this exact structure:",
    '{"question": {"ko":"...","en":"...","ja":"...","zh":"...","fr":"...","de":"...","es":"...","pt":"..."}, "options": {"ko":["...","..."],"en":["..."],"ja":["..."],"zh":["..."],"fr":["..."],"de":["..."],"es":["..."],"pt":["..."]}}',
    "",
    `Source (${source}):`,
    `Question: ${question}`,
    `Option 1: ${options[0]}`,
    `Option 2: ${options[1]}`,
    "",
    "Keep the casual, opinionated tone. Option order must match exactly. Two options only.",
  ].join("\n");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const m = content.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : content);
}

(async () => {
  const client = new Client({
    host: 'aws-1-us-west-2.pooler.supabase.com', port: 5432,
    database: 'postgres', user: 'postgres.zntyjtjodyzizoafxord',
    password: 'Djfbm99#HoH4',
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000,
  });
  await client.connect();

  // 기존 active poll 제거 (재시드 방지)
  await client.query(`delete from public.polls where status = 'active'`);

  // 번역
  console.log('번역 중...');
  const tr = await translate(QUESTION_KO, OPTIONS_KO, "ko", LOCALES);
  console.log('번역 결과:', JSON.stringify(tr, null, 2));

  // 번역본 + 원문 병합 (안전장치: 누락시 원문)
  const question = {};
  const options = {};
  for (const l of LOCALES) {
    question[l] = tr.question?.[l] || QUESTION_KO;
    options[l] = tr.options?.[l] && tr.options[l].length === 2 ? tr.options[l] : OPTIONS_KO;
  }

  // 3일 후 종료
  const endsAt = new Date(Date.now() + 3 * 86400000).toISOString();

  const { rows } = await client.query(
    `insert into public.polls (question, options, status, ends_at, created_at)
     values ($1, $2, 'active', $3, now())
     returning id, question, options`,
    [question, options, endsAt]
  );
  const poll = rows[0];
  console.log('\n✅ 시드 완료');
  console.log('poll_id:', poll.id);
  console.log('질문(ko):', poll.question.ko);
  console.log('질문(en):', poll.question.en);
  console.log('질문(ja):', poll.question.ja);
  console.log('선택지(ko):', poll.options.ko);
  console.log('선택지(en):', poll.options.en);
  console.log('ends_at:', endsAt);

  await client.end();
})().catch(async (e) => {
  console.error('❌', e.message);
  process.exit(1);
});
